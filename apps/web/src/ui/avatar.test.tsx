import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Avatar, getInitials, personTone } from './avatar'

describe('Avatar (tasarim.md §4)', () => {
  it('W3: baş harfler Türkçe büyük harfle üretilir (i -> İ, ı -> I)', () => {
    expect(getInitials('ilknur ışık')).toBe('İI')
    expect(getInitials('Ayşe Yılmaz')).toBe('AY')
  })

  it('W3: tek sözcük tek harf, fazla sözcük ilk ikisiyle sınırlı, boş ad "?" olur', () => {
    expect(getInitials('Elif')).toBe('E')
    expect(getInitials('Mehmet Ali Kaya')).toBe('MA')
    expect(getInitials('   ')).toBe('?')
  })

  it('W3: kişi tonu aynı kimlik için sabit, 1-5 aralığındadır', () => {
    const tone = personTone('staff-123')
    expect(tone).toBe(personTone('staff-123'))
    expect(tone).toBeGreaterThanOrEqual(1)
    expect(tone).toBeLessThanOrEqual(5)
  })

  it('W3: personel avatarı kişi tonu sınıfı alır; müşteri avatarı nötr gridir', () => {
    const { unmount } = render(<Avatar name="Ayşe Yılmaz" tone={2} />)
    expect(screen.getByText('AY').className).toContain('bg-person-2-bg')
    unmount()
    render(<Avatar name="Ayşe Yılmaz" />)
    const neutral = screen.getByText('AY')
    expect(neutral.className).toContain('bg-surface-active')
    expect(neutral.className).not.toContain('person')
  })

  it('W3: avatar süs sayılır (aria-hidden); ad yanındaki metinden okunur', () => {
    render(<Avatar name="Ayşe Yılmaz" />)
    expect(screen.getByText('AY').getAttribute('aria-hidden')).toBe('true')
  })
})
