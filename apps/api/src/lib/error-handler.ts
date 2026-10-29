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
    // Diger body-parser istemci hatalari (415 desteklenmeyen charset/encoding, 400 istek kesildi...): http-errors
    // bunlari expose=true ve 4xx ile isaretler. Mesaj govdeden parca tasiyabildigi icin yansitilmaz, loglanmaz.
    const { status, expose } = (err ?? {}) as { status?: unknown; expose?: unknown }
    if (typeof type === 'string' && expose === true && typeof status === 'number' && status >= 400 && status < 500) {
      if (status === 413) {
        res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'İstek gövdesi çok büyük.' } })
      } else if (status === 415) {
        res.status(415).json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Desteklenmeyen içerik türü.' } })
      } else {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz istek gövdesi.' } })
      }
      return
    }
    logUnhandled(err)
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Sunucu hatası.' } })
  }
}
