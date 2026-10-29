import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const sendMock = vi.hoisted(() => vi.fn())
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))
vi.mock('../lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

import { sendWelcomeEmail } from '../lib/email'

let savedKey: string | undefined
beforeEach(() => {
  savedKey = process.env.RESEND_API_KEY
  process.env.RESEND_API_KEY = 're_test'
  sendMock.mockReset().mockResolvedValue({ data: { id: 'e1' }, error: null })
})
afterEach(() => {
  if (savedKey === undefined) delete process.env.RESEND_API_KEY
  else process.env.RESEND_API_KEY = savedKey
})

const sent = () => sendMock.mock.calls[0][0] as { subject: string; html: string }

describe('S4 onerileri: hos geldin e-postasi', () => {
  it('salonName HTML kacisi yapilir (etiket/ozel karakter govdede calismaz)', async () => {
    await sendWelcomeEmail('a@b.com', '<img src=x onerror=alert(1)> & "Salon"', new Date('2026-12-01T10:00:00Z'))
    expect(sent().html).not.toContain('<img')
    expect(sent().html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;Salon&quot;')
  })

  it('konu satirinda satir sonu karakterleri temizlenir (baslik enjeksiyonu yok)', async () => {
    await sendWelcomeEmail('a@b.com', 'Salon\r\nBcc: kotu@ornek.com', new Date('2026-12-01T10:00:00Z'))
    expect(sent().subject).not.toMatch(/[\r\n]/)
    expect(sent().subject).toContain('Salon')
  })

  it('deneme bitis tarihi Europe/Istanbul gunune gore yazilir (UTC 22:30 = ertesi gun 01:30)', async () => {
    // Konteyner TZ=UTC ile calisir (proje kurali 3); yerel makinenin saat dilimi sonucu maskelemesin.
    const savedTz = process.env.TZ
    process.env.TZ = 'UTC'
    try {
      await sendWelcomeEmail('a@b.com', 'Salon', new Date('2026-12-01T22:30:00Z'))
    } finally {
      if (savedTz === undefined) delete process.env.TZ
      else process.env.TZ = savedTz
    }
    expect(sent().html).toContain('02 Aralık 2026')
    expect(sent().html).not.toContain('01 Aralık 2026')
  })
})
