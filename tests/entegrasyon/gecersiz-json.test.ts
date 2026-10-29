import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../app'

// S8 regresyonu (gerçek createApp, sahte katman yok): bozuk JSON 500 değil 400; çok büyük gövde 413.
// Bu dosya tests/entegrasyon altındadır; api-test.sh koşudan önce apps/api/src/__tests__/ içine kopyalar.
const app = createApp({ rateLimitMax: 1000 })

describe('S8: geçersiz JSON gövdesi', () => {
  const yollar = ['/api/v1/auth/login', '/api/v1/auth/forgot-password', '/api/v1/auth/register']

  for (const yol of yollar) {
    it(`${yol}: bozuk JSON 400 döner ve iç hata sızdırmaz`, async () => {
      const res = await request(app).post(yol).set('Content-Type', 'application/json').send('{"email": "a@b.test", bozuk')
      expect(res.status).toBe(400)
      const metin = JSON.stringify(res.body)
      expect(metin).not.toMatch(/SyntaxError|Unexpected token|at \w+ \(/)
    })
  }

  it('olumlu eşleme: geçerli JSON aynı uçta 500 vermez', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'yok@ornek.test', password: 'x' })
    expect(res.status).toBeLessThan(500)
  })

  it('çok büyük gövde 413 döner', async () => {
    const buyuk = JSON.stringify({ email: 'a@b.test', password: 'x'.repeat(2 * 1024 * 1024) })
    const res = await request(app).post('/api/v1/auth/login').set('Content-Type', 'application/json').send(buyuk)
    expect(res.status).toBe(413)
  })
})
