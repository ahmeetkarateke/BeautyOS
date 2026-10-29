import type { ErrorRequestHandler } from 'express'

type UnhandledLogger = (err: unknown) => void

/**
 * Tek hata isleyicisi (app.ts ve index.ts ortak). body-parser hatalari istemci hatasidir:
 * bozuk JSON 400, asiri buyuk govde 413. Bunlar loglanmaz (hata metni govdeden parca tasiyabilir, kisisel veri riski).
 * Digerleri 500 INTERNAL_ERROR; ayrinti yalniz log'a gider.
 */
export function apiErrorHandler(logUnhandled: UnhandledLogger): ErrorRequestHandler {
  return (err, _req, res, next) => {
    if (res.headersSent) {
      next(err)
      return
    }
    const type = (err as { type?: unknown } | null)?.type
    if (type === 'entity.parse.failed') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz istek gövdesi.' } })
      return
    }
    if (type === 'entity.too.large') {
      res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'İstek gövdesi çok büyük.' } })
      return
    }
    logUnhandled(err)
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Sunucu hatası.' } })
  }
}
