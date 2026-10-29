import { describe, it, expect, vi } from 'vitest'
import { Writable } from 'node:stream'

// S4-K1 (denetim S4K1-1): mock SMS saglayicisi (NETGSM bos iken her ortamda etkin) mesaj govdesini ve alici telefonunu log'lamaz.
const lines = vi.hoisted(() => [] as string[])
vi.mock('../lib/logger', async () => {
  const { createLogger } = await vi.importActual<typeof import('../lib/logger')>('../lib/logger')
  const stream = new Writable({ write(chunk, _e, cb) { lines.push(chunk.toString()); cb() } })
  return { createLogger, logger: createLogger(stream) }
})

import { MockSmsProvider } from '../lib/sms/mock-provider'
import { createLogger } from '../lib/logger'

const BODY = 'Sayin Isik Yilmaz, dogrulama kodunuz 482913'

describe('S4-K1: mock SMS log', () => {
  it('K1: log satirinda govde, ad, OTP kodu ve telefon yok; yalniz parca sayisi ve uzunluk var', async () => {
    const result = await new MockSmsProvider().send({ to: '905551112233', body: BODY })
    expect(result.success).toBe(true)
    const out = lines.join('\n')
    expect(out).toContain('partCount')
    for (const secret of ['Isik Yilmaz', '482913', '905551112233', 'dogrulama']) expect(out).not.toContain(secret)
    expect(JSON.parse(out.trim().split('\n')[0]).bodyLength).toBe(BODY.length)
  })

  it('K1: redact listesi `body` anahtarini da siler (baska bir cagri govdeyi log nesnesine koysa bile)', () => {
    const own: string[] = []
    const logger = createLogger(new Writable({ write(c, _e, cb) { own.push(c.toString()); cb() } }))
    logger.info({ body: BODY, nested: { body: BODY } }, 'x')
    expect(own.join('')).not.toContain('482913')
  })
})
