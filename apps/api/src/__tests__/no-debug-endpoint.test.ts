import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// index.ts bootstrap() içinde kurulduğu için rota tablosu supertest ile erişilemez;
// kimlik doğrulamasız ve ücretli Gemini isteği atan /debug rotasının kaynakta
// yeniden eklenmediğini kaynak taramasıyla sabitliyoruz.
describe('production entrypoint', () => {
  const source = readFileSync(resolve(__dirname, '../index.ts'), 'utf8')

  it('does not register an unauthenticated /debug route', () => {
    expect(source).not.toMatch(/app\.(get|post|all|use)\(\s*['"`]\/debug/)
  })

  it('does not call Gemini from a route handler', () => {
    expect(source).not.toMatch(/generateContent/)
  })

  it('still registers the /health route (guards against over-deleting)', () => {
    expect(source).toMatch(/app\.get\(\s*'\/health'/)
  })
})
