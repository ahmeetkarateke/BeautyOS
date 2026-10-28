// Phone verification: 6 haneli kod ile telefon doğrulama
// - Rate limited (1 numara × 3 dakika)
// - Kod ömrü 10 dakika
// - 5 yanlış denemeden sonra invalidate

import { db } from './db'
import { sendSms, normalizePhoneTR } from './sms'
import { DeliveryPurpose } from '@prisma/client'

const CODE_TTL_MS = 10 * 60 * 1000
const RESEND_COOLDOWN_MS = 3 * 60 * 1000
const MAX_ATTEMPTS = 5

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export interface SendCodeResult {
  ok: true
  // Yalnız NODE_ENV !== 'production' ve sahte sağlayıcıyla döner; üretimde asla
  devCode?: string
}

export interface SendCodeError {
  ok: false
  error: 'INVALID_PHONE' | 'TOO_SOON' | 'SMS_FAILED' | 'SMS_UNAVAILABLE'
  message: string
  retryAfterSec?: number
}

export async function sendVerificationCode(args: {
  phone: string
  tenantId?: string | null
  ipAddress?: string
}): Promise<SendCodeResult | SendCodeError> {
  const normalized = normalizePhoneTR(args.phone)
  if (!normalized) {
    return { ok: false, error: 'INVALID_PHONE', message: 'Geçersiz telefon numarası formatı.' }
  }

  const smsConfigured = Boolean(process.env.NETGSM_USERCODE)
  const isProduction = process.env.NODE_ENV === 'production'
  // Üretimde gerçek SMS sağlayıcısı yoksa kod hiçbir yere iletilemez; kodu yanıtta vermek doğrulamayı anlamsız kılar.
  if (isProduction && !smsConfigured) {
    return { ok: false, error: 'SMS_UNAVAILABLE', message: 'Telefon doğrulama şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.' }
  }

  // Rate limit: son 3 dakika içinde aynı numaraya gönderim varsa engelle
  const recent = await db.phoneVerification.findFirst({
    where: {
      phone: normalized,
      createdAt: { gte: new Date(Date.now() - RESEND_COOLDOWN_MS) },
    },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  if (recent) {
    const elapsed = Date.now() - recent.createdAt.getTime()
    const retryAfterSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000)
    return {
      ok: false,
      error: 'TOO_SOON',
      message: `Çok sık deneme. ${retryAfterSec} saniye sonra tekrar deneyin.`,
      retryAfterSec,
    }
  }

  const code = generateCode()
  const expiresAt = new Date(Date.now() + CODE_TTL_MS)

  const tenantId = args.tenantId ?? null
  await db.phoneVerification.create({
    data: {
      tenantId,
      phone: normalized,
      code,
      expiresAt,
      ipAddress: args.ipAddress ?? null,
    },
  })

  const body = `BeautyOS doğrulama kodunuz: ${code}\nKod 10 dakika geçerlidir. Güvenliğiniz için kimseyle paylaşmayın.`

  // Tenant context'i varsa delivery'i o tenant'a kaydet, yoksa public booking için
  // mock provider zaten herkes için çalışır — gerçek SMS sadece NETGSM_USERCODE varsa
  if (tenantId) {
    const { result } = await sendSms({
      tenantId,
      to: normalized,
      body,
      purpose: DeliveryPurpose.verification,
    })
    if (!result.success) {
      return { ok: false, error: 'SMS_FAILED', message: result.errorMessage ?? 'SMS gönderilemedi.' }
    }
  } else {
    // Public booking — tenantId yok, doğrudan provider çağır (delivery kaydı atlanır)
    const { getSmsProvider } = await import('./sms')
    const result = await getSmsProvider().send({ to: normalized, body })
    if (!result.success) {
      return { ok: false, error: 'SMS_FAILED', message: result.errorMessage ?? 'SMS gönderilemedi.' }
    }
  }

  return { ok: true, devCode: !isProduction && !smsConfigured ? code : undefined }
}

export interface VerifyCodeResult {
  ok: true
  phone: string  // normalize edilmiş telefon
}
export interface VerifyCodeError {
  ok: false
  error: 'NO_CODE' | 'EXPIRED' | 'INVALID_CODE' | 'TOO_MANY_ATTEMPTS' | 'INVALID_PHONE'
  message: string
}

export async function verifyCode(args: {
  phone: string
  code: string
}): Promise<VerifyCodeResult | VerifyCodeError> {
  const normalized = normalizePhoneTR(args.phone)
  if (!normalized) {
    return { ok: false, error: 'INVALID_PHONE', message: 'Geçersiz telefon numarası.' }
  }

  const verification = await db.phoneVerification.findFirst({
    where: { phone: normalized, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  })

  if (!verification) {
    return { ok: false, error: 'NO_CODE', message: 'Doğrulama kodu bulunamadı. Önce kod isteyin.' }
  }

  if (verification.expiresAt < new Date()) {
    return { ok: false, error: 'EXPIRED', message: 'Kod süresi doldu. Yeni kod isteyin.' }
  }

  if (verification.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: 'TOO_MANY_ATTEMPTS', message: 'Çok fazla yanlış deneme. Yeni kod isteyin.' }
  }

  if (verification.code !== args.code.trim()) {
    await db.phoneVerification.update({
      where: { id: verification.id },
      data: { attempts: { increment: 1 } },
    })
    return { ok: false, error: 'INVALID_CODE', message: 'Kod hatalı.' }
  }

  // Başarılı — consume et
  await db.phoneVerification.update({
    where: { id: verification.id },
    data: { consumedAt: new Date() },
  })

  return { ok: true, phone: normalized }
}
