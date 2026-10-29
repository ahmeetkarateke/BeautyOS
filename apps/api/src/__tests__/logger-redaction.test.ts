import { describe, it, expect } from 'vitest'
import { Writable } from 'node:stream'
import { createLogger } from '../lib/logger'

// S4-K1: log satirlari ad, telefon, e-posta, jeton ve URL sirlari icermez. Gercek pino cikisi okunur.
function capture() {
  const lines: string[] = []
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(chunk.toString())
      cb()
    },
  })
  return { logger: createLogger(stream), text: () => lines.join('\n') }
}

const PHONE = '905551112233'
const TOKEN = '123456789:AAFakeTelegramBotTokenValue_xyz'
const NAME = 'Isik Yilmaz'

function axiosLikeError() {
  const err = new Error('Request failed with status code 400') as Error & Record<string, unknown>
  err.name = 'AxiosError'
  err.isAxiosError = true
  err.code = 'ERR_BAD_REQUEST'
  err.config = {
    url: `https://api.telegram.org/bot${TOKEN}/sendMessage`,
    data: JSON.stringify({ chat_id: PHONE, text: `Merhaba ${NAME}` }),
    headers: { Authorization: `Bearer ${TOKEN}` },
  }
  err.request = { path: `/bot${TOKEN}/sendMessage` }
  err.response = { status: 400, data: { description: `chat ${PHONE} not found`, name: NAME } }
  return err
}

describe('S4-K1: logger sizinti korumasi', () => {
  it('K1: axios hatasi yalniz {status, code, message} olarak yazilir (URL, govde, baslik yok)', () => {
    const { logger, text } = capture()
    logger.error({ err: axiosLikeError() }, 'Telegram API cagrisi basarisiz')
    const out = text()
    expect(out).not.toContain(TOKEN)
    expect(out).not.toContain(PHONE)
    expect(out).not.toContain(NAME)
    expect(out).not.toContain('sendMessage')
    const entry = JSON.parse(out.trim().split('\n')[0])
    expect(entry.err).toEqual({ status: 400, code: 'ERR_BAD_REQUEST', message: 'Request failed with status code 400' })
  })

  it('K1: `error` anahtari da ayni sekilde temizlenir', () => {
    const { logger, text } = capture()
    logger.error({ error: axiosLikeError() }, 'WhatsApp hatasi')
    expect(text()).not.toContain(TOKEN)
    expect(JSON.parse(text().trim()).error.status).toBe(400)
  })

  it('K1: Prisma hatasinin mesaji (arguman degerleri: ad, telefon) yazilmaz; yalniz tur ve kod kalir', () => {
    const { logger, text } = capture()
    const err = new Error(`Invalid \`prisma.customer.create()\` invocation:\n{ data: { fullName: "${NAME}", phone: "${PHONE}" } }\nUnique constraint failed`)
    err.name = 'PrismaClientKnownRequestError'
    ;(err as Error & { code: string }).code = 'P2002'
    logger.error({ err }, 'Kayit hatasi')
    const out = text()
    expect(out).not.toContain(NAME)
    expect(out).not.toContain(PHONE)
    expect(JSON.parse(out.trim()).err).toEqual({ type: 'PrismaClientKnownRequestError', code: 'P2002' })
  })

  it('K1: Prisma dogrulama hatasi (kodsuz) da arguman icermez', () => {
    const { logger, text } = capture()
    const err = new Error(`Argument phone: "${PHONE}" invalid`)
    err.name = 'PrismaClientValidationError'
    logger.error({ err }, 'Dogrulama hatasi')
    expect(text()).not.toContain(PHONE)
  })

  it('K1: siradan hatada mesaj korunur ama jeton, telefon ve e-posta kalibi maskelenir', () => {
    const { logger, text } = capture()
    logger.error({ err: new Error(`fetch https://x.test/bot${TOKEN}/y?key=SECRETKEY failed for ${PHONE} ISIK@Ornek.com`) }, 'Hata')
    const out = text()
    expect(out).not.toContain(TOKEN)
    expect(out).not.toContain('SECRETKEY')
    expect(out).not.toContain(PHONE)
    expect(out.toLowerCase()).not.toContain('isik@ornek.com')
    expect(JSON.parse(out.trim()).err.message).toContain('failed for')
  })

  it('K1: dize hata alani (error: result.errorMessage) da temizlenir', () => {
    const { logger, text } = capture()
    logger.error({ error: `gonderilemedi ${PHONE}` }, 'SMS')
    expect(text()).not.toContain(PHONE)
  })

  it('K1: redact kurallari ad, telefon, e-posta, jeton, parola ve kimlik baslik alanlarini siler (ic ice dahil)', () => {
    const { logger, text } = capture()
    logger.info(
      {
        phone: PHONE,
        from: PHONE,
        customer: { fullName: NAME, email: 'a@b.com', phone: PHONE },
        refreshToken: 'RT-SECRET',
        password: 'Sifre123!',
        req: { headers: { authorization: 'Bearer ABC', cookie: 'refreshToken=RT-SECRET' } },
        appointmentId: 'apt-1',
        tenantId: 't-1',
      },
      'olay',
    )
    const out = text()
    for (const secret of [PHONE, NAME, 'a@b.com', 'RT-SECRET', 'Sifre123!', 'Bearer ABC']) expect(out).not.toContain(secret)
    const entry = JSON.parse(out.trim())
    expect(entry.appointmentId).toBe('apt-1')
    expect(entry.tenantId).toBe('t-1')
  })
})
