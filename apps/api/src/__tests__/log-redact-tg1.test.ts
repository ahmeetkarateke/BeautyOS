import { describe, it, expect } from 'vitest'
import pino from 'pino'
import { REDACT_PATHS } from '../lib/log-safe'

// TG1-1: Telegram sohbet no ve talep sahibi alanları, nesne log'a düşse bile açık yazılmaz (üç iç içe düzey).
function logged(obj: Record<string, unknown>): string {
  const lines: string[] = []
  const log = pino({ redact: { paths: REDACT_PATHS, censor: '[gizli]' } }, { write: (l: string) => void lines.push(l) })
  log.info(obj, 'x')
  return lines.join('')
}

describe('TG1 log redact listesi', () => {
  const fields = ['telegramChatId', 'requestedChatId', 'requestedPhone', 'requestedName', 'customerRef']

  for (const field of fields) {
    it(`${field} üst, bir ve iki düzey iç içe nesnede [gizli] olur`, () => {
      const out = logged({ [field]: 'SIR-1', a: { [field]: 'SIR-2' }, b: { c: { [field]: 'SIR-3' } } })
      expect(out).not.toMatch(/SIR-/)
      expect(out.match(/\[gizli\]/g)).toHaveLength(3)
    })
  }
})
