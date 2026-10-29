import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import { apiErrorHandler } from '../lib/error-handler'

// S8 onerisi: body-parser'in tum istemci hatalari (expose=true, status<500) 4xx doner, loglanmaz.
function appWithParser() {
  const log = vi.fn()
  const app = express()
  app.use(express.json())
  app.post('/x', (_req, res) => res.json({ ok: true }))
  app.use(apiErrorHandler(log))
  return { app, log }
}

function appThrowing(err: object) {
  const log = vi.fn()
  const app = express()
  app.get('/x', (_req, _res, next) => next(err))
  app.use(apiErrorHandler(log))
  return { app, log }
}

describe('S8: body-parser istemci hatalari', () => {
  it('desteklenmeyen karakter kumesi -> 415 UNSUPPORTED_MEDIA_TYPE (500 degil), loglanmaz', async () => {
    const { app, log } = appWithParser()
    const res = await request(app).post('/x').set('Content-Type', 'application/json; charset=iso-8859-1').send('{}')
    expect(res.status).toBe(415)
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE')
    expect(log).not.toHaveBeenCalled()
  })

  it('desteklenmeyen Content-Encoding -> 415 UNSUPPORTED_MEDIA_TYPE', async () => {
    const { app, log } = appWithParser()
    const res = await request(app).post('/x').set('Content-Type', 'application/json').set('Content-Encoding', 'foo').send('{}')
    expect(res.status).toBe(415)
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE')
    expect(log).not.toHaveBeenCalled()
  })

  it('istemci istegi yarida kesti (request.aborted) -> 400 VALIDATION_ERROR, loglanmaz', async () => {
    const { app, log } = appThrowing(Object.assign(new Error('request aborted'), { type: 'request.aborted', status: 400, expose: true }))
    const res = await request(app).get('/x')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(log).not.toHaveBeenCalled()
  })

  it('type tasiyan ama expose olmayan 4xx hata (tek kural eksik) 500 kalir ve loglanir', async () => {
    const { app, log } = appThrowing(Object.assign(new Error('x'), { type: 'request.aborted', status: 400 }))
    const res = await request(app).get('/x')
    expect(res.status).toBe(500)
    expect(log).toHaveBeenCalledTimes(1)
  })

  it('expose olan ama type tasimayan 4xx hata (tek kural eksik) 500 kalir ve loglanir', async () => {
    const { app, log } = appThrowing(Object.assign(new Error('x'), { status: 400, expose: true }))
    const res = await request(app).get('/x')
    expect(res.status).toBe(500)
    expect(log).toHaveBeenCalledTimes(1)
  })

  it('diger body-parser 413 turleri (request.size.invalid) PAYLOAD_TOO_LARGE olarak korunur', async () => {
    const { app, log } = appThrowing(Object.assign(new Error('x'), { type: 'request.size.invalid', status: 413, expose: true }))
    const res = await request(app).get('/x')
    expect(res.status).toBe(413)
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE')
    expect(log).not.toHaveBeenCalled()
  })

  it('body-parser disi hata, status 400 tasisa da expose/type yoksa 500 kalir ve loglanir', async () => {
    const { app, log } = appThrowing(Object.assign(new Error('veritabani sifresi=abc'), { status: 400 }))
    const res = await request(app).get('/x')
    expect(res.status).toBe(500)
    expect(res.body.error.code).toBe('INTERNAL_ERROR')
    expect(log).toHaveBeenCalledTimes(1)
  })

  it('hata mesaji govdeye yansitilmaz', async () => {
    const { app } = appThrowing(Object.assign(new Error('gizli@ornek.com'), { type: 'request.aborted', status: 400, expose: true }))
    const res = await request(app).get('/x')
    expect(JSON.stringify(res.body)).not.toContain('gizli@ornek.com')
  })
})
