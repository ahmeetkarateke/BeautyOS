import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { InputField, PhoneField, SelectField, TextareaField, focusFirstInvalid } from './field'

describe('Form alanı (tasarim.md §4)', () => {
  it('W3: etiket her zaman görünür ve alana bağlıdır', () => {
    render(<InputField label="Ad soyad" />)
    const input = screen.getByLabelText('Ad soyad')
    expect(input.tagName).toBe('INPUT')
  })

  it('W3: isteğe bağlı alan "(isteğe bağlı)" yazar; zorunlu için işaret yoktur', () => {
    const { rerender } = render(<InputField label="E-posta" optional />)
    expect(screen.getByText('(isteğe bağlı)')).toBeTruthy()
    rerender(<InputField label="E-posta" />)
    expect(screen.queryByText('(isteğe bağlı)')).toBeNull()
    expect(document.body.textContent).not.toContain('*')
  })

  it('W3: hata alanın altında role=alert, aria-invalid ve aria-describedby ile bağlanır', () => {
    render(<InputField label="Ad soyad" error="Ad soyad yazın." />)
    const input = screen.getByLabelText('Ad soyad')
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Ad soyad yazın.')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(alert.id)
  })

  it('W3: hata yokken aria-invalid yoktur ve ipucu aria-describedby içindedir', () => {
    render(<InputField label="Ad soyad" hint="Kimlikteki gibi yazın." />)
    const input = screen.getByLabelText('Ad soyad')
    expect(input.getAttribute('aria-invalid')).toBeNull()
    const hint = screen.getByText('Kimlikteki gibi yazın.')
    expect(input.getAttribute('aria-describedby')).toBe(hint.id)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('W3: e-posta alanında spellcheck kapalı; autocomplete ve inputmode geçer', () => {
    render(<InputField label="E-posta" type="email" autoComplete="email" inputMode="email" spellCheck={false} />)
    const input = screen.getByLabelText('E-posta')
    expect(input.getAttribute('spellcheck')).toBe('false')
    expect(input.getAttribute('autocomplete')).toBe('email')
    expect(input.getAttribute('inputmode')).toBe('email')
  })

  it('W3: alan name vermeden çalışır (varsayılan name yok)', () => {
    render(<InputField label="Ad soyad" />)
    expect(screen.getByLabelText('Ad soyad').getAttribute('name')).toBeNull()
  })

  it('W3: Select ve Textarea de aynı etiket/hata sözleşmesini taşır', () => {
    render(
      <>
        <SelectField label="Hizmet" error="Hizmet seçin.">
          <option value="">Seçin…</option>
        </SelectField>
        <TextareaField label="Not" optional />
      </>,
    )
    expect(screen.getByLabelText('Hizmet').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByLabelText(/Not/).tagName).toBe('TEXTAREA')
  })

  it('W3: ilk hatalı alana odaklanır', () => {
    render(
      <form data-testid="f">
        <InputField label="Ad" />
        <InputField label="Telefon" error="Geçersiz." />
        <InputField label="E-posta" error="Geçersiz." />
      </form>,
    )
    focusFirstInvalid(screen.getByTestId('f'))
    expect(document.activeElement).toBe(screen.getByLabelText('Telefon'))
  })
})

describe('Telefon alanı (+90)', () => {
  it('W3: "+90" ön eki görünür, alan tel girdisidir, yer tutucu örnek biçimdedir', () => {
    render(<PhoneField label="Telefon" value="" onValueChange={() => {}} />)
    expect(screen.getByText('+90')).toBeTruthy()
    const input = screen.getByLabelText('Telefon')
    expect(input.getAttribute('type')).toBe('tel')
    expect(input.getAttribute('inputmode')).toBe('tel')
    expect(input.getAttribute('autocomplete')).toBe('tel-national')
    expect(input.getAttribute('placeholder')).toBe('5xx xxx xx xx')
  })

  it('W3: yazılan değer 5xx xxx xx xx biçiminde gösterilir, üst bileşene yalnız rakamlar gider', () => {
    const onValueChange = vi.fn()
    render(<PhoneField label="Telefon" value="5321234567" onValueChange={onValueChange} />)
    const input = screen.getByLabelText('Telefon') as HTMLInputElement
    expect(input.value).toBe('532 123 45 67')
    fireEvent.change(input, { target: { value: '+90 533 999 88 77' } })
    expect(onValueChange).toHaveBeenCalledWith('5339998877')
  })
})
