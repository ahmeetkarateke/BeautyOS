import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import { readFileSync } from 'node:fs'
import path from 'node:path'
// Gercek Redis/veritabani baglantisi acilmasin: kuyruk ve db sahtelenir.
vi.mock('../lib/queue', () => ({ remindersQueue: { add: vi.fn(), remove: vi.fn() }, startReminderWorker: vi.fn() }))
vi.mock('../lib/db', () => ({ db: {} }))

import { createApp } from '../app'
import { apiErrorHandler } from '../lib/error-handler'

// S8: bozuk istek govdesi 500 degil 400 doner. Veritabani gerektirmez (istek rotaya hic ulasmaz).
describe('S8: gecersiz JSON govdesi', () => {
  const app = createApp({ rateLimitMax: 1000 })

  it('K1: bozuk JSON -> 400 VALIDATION_ERROR (500 degil), govde ve hata ayrintisi yansitilmaz', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "gizli@ornek.com", "password": ')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz istek gövdesi.' } })
    expect(JSON.stringify(res.body)).not.toContain('gizli@ornek.com')
  })

  it('K1: ayni davranis kiraci yollarinda da gecerli (kimlik dogrulamadan once govde cozulur)', async () => {
    const res = await request(app)
      .post('/api/v1/tenants/salon/appointments')
      .set('Content-Type', 'application/json')
      .send('{bozuk')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('K2: cok buyuk govde -> 413 PAYLOAD_TOO_LARGE', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(300_000) }))
    expect(res.status).toBe(413)
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE')
  })

  it('K3: beklenmeyen hata hala 500 INTERNAL_ERROR doner ve ayrinti sizmaz', async () => {
    const log = vi.fn()
    const small = express()
    small.get('/boom', () => {
      throw new Error('veritabani sifresi=abc')
    })
    small.use(apiErrorHandler(log))
    const res = await request(small).get('/boom')
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Sunucu hatası.' } })
    expect(log).toHaveBeenCalledTimes(1)
  })

  it('K3: istemci hatalari (400/413) hata gunlugune yazilmaz (govde parcasi kisisel veri tasiyabilir)', async () => {
    const log = vi.fn()
    const small = express()
    small.use(express.json())
    small.use(apiErrorHandler(log))
    await request(small).post('/x').set('Content-Type', 'application/json').send('{"ad": "Ayşe", ')
    expect(log).not.toHaveBeenCalled()
  })

  it('K4: index.ts de ayni hata isleyicisini kullanir (yol tablosu app.ts ile ayni olmali; kaynak taramasi)', () => {
    const source = readFileSync(path.resolve(__dirname, '../index.ts'), 'utf8')
    expect(source).toContain('apiErrorHandler(')
    expect(source).not.toMatch(/'Unhandled error'/)
  })
})
