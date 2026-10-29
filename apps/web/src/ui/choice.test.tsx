import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Checkbox, LegalCheckbox, Radio, RadioGroup, Switch } from './choice'

describe('Seçenek: onay kutusu ve radyo (tasarim.md §4)', () => {
  it('W3: etiket metni tıklama hedefidir; metne tıklamak kutuyu işaretler', () => {
    const onCheckedChange = vi.fn()
    render(<Checkbox label="SMS hatırlatması gönder" onCheckedChange={onCheckedChange} />)
    fireEvent.click(screen.getByText('SMS hatırlatması gönder'))
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it('W3: açıklama alanın erişilebilir tanımına bağlanır', () => {
    render(<Checkbox label="Kampanya iletisi" description="İstediğiniz zaman vazgeçebilirsiniz." />)
    const box = screen.getByRole('checkbox', { name: 'Kampanya iletisi' })
    const desc = screen.getByText('İstediğiniz zaman vazgeçebilirsiniz.')
    expect(box.getAttribute('aria-describedby')).toBe(desc.id)
  })

  it('W3: yasal onay kutusu hiçbir zaman önceden işaretli gelmez', () => {
    render(<LegalCheckbox label="Kullanım koşullarını okudum ve kabul ediyorum" />)
    const box = screen.getByRole('checkbox') as HTMLInputElement
    expect(box.checked).toBe(false)
  })

  it('W3: yasal onay kutusu defaultChecked kabul etmez (tür düzeyinde engel, çalışma anında yok sayılır)', () => {
    render(<LegalCheckbox label="Kabul ediyorum" {...({ defaultChecked: true } as object)} />)
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
  })

  it('W3: radyo grubu seçileni bildirir ve grup adı legend ile gelir', () => {
    function Demo() {
      const [value, setValue] = useState('nakit')
      return (
        <RadioGroup legend="Ödeme yöntemi" value={value} onValueChange={setValue}>
          <Radio value="nakit" label="Nakit" />
          <Radio value="kart" label="Kart" />
        </RadioGroup>
      )
    }
    render(<Demo />)
    expect(screen.getByRole('radiogroup', { name: 'Ödeme yöntemi' })).toBeTruthy()
    expect((screen.getByRole('radio', { name: 'Nakit' }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByText('Kart'))
    expect((screen.getByRole('radio', { name: 'Kart' }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByRole('radio', { name: 'Nakit' }) as HTMLInputElement).checked).toBe(false)
  })

  it('W3: radyolar aynı grup adını paylaşır (ok tuşu gezinmesi tarayıcıdan)', () => {
    render(
      <RadioGroup legend="Kanal" value="a" onValueChange={() => {}}>
        <Radio value="a" label="A" />
        <Radio value="b" label="B" />
      </RadioGroup>,
    )
    const [a, b] = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(a.name).toBeTruthy()
    expect(a.name).toBe(b.name)
  })
})

describe('Anahtar', () => {
  it('W3: switch rolü, görünür etiket ve aria-checked/checked durumu', () => {
    const onCheckedChange = vi.fn()
    render(<Switch label="Online randevu açık" checked={false} onCheckedChange={onCheckedChange} />)
    const sw = screen.getByRole('switch', { name: 'Online randevu açık' }) as HTMLInputElement
    expect(sw.checked).toBe(false)
    fireEvent.click(sw)
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it('W3: etiket metnine tıklamak anahtarı değiştirir', () => {
    const onCheckedChange = vi.fn()
    render(<Switch label="Hatırlatma" checked onCheckedChange={onCheckedChange} />)
    fireEvent.click(screen.getByText('Hatırlatma'))
    expect(onCheckedChange).toHaveBeenCalledWith(false)
  })
})
