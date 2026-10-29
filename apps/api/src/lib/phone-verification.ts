// Phone verification: 6 haneli kod ile telefon doğrulama
// - Rate limited (1 numara × 3 dakika, saatte 5 gönderim)
// - Kod ömrü 10 dakika; veritabanında yalnız HMAC özeti saklanır
// - 5 yanlış denemeden sonra invalidate (sayaç atomik)

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { db } from './db'
import { isSmsConfigured } from './booking-mode'
import { sendSms, normalizePhoneTR } from './sms'
import { renderTemplate } from './messages/templates'
import { DeliveryPurpose } from '@prisma/client'

const CODE_TTL_MS = 10 * 60 * 1000
const RESEND_COOLDOWN_MS = 3 * 60 * 1000
const MAX_ATTEMPTS = 5
const MAX_SENDS_PER_HOUR = 5
const HOUR_MS = 60 * 60 * 1000

function generateCode(): string {
  return randomInt(100000, 1000000).toString()
}

/** Kod, telefon ve JWT_SECRET'a bağlı HMAC özeti; veritabanı sızsa bile 6 haneli kod doğrudan okunamaz. */
export function hashCode(phone: string, code: string): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET tanımlı değil: doğrulama kodu özeti üretilemez')
  return createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex')
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
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

  const smsConfigured = isSmsConfigured()
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

  const sentLastHour = await db.phoneVerification.count({
    where: { phone: normalized, createdAt: { gte: new Date(Date.now() - HOUR_MS) } },
  })
  if (sentLastHour >= MAX_SENDS_PER_HOUR) {
    return { ok: false, error: 'TOO_SOON', message: 'Bu numara için saatlik kod sınırına ulaşıldı. Lütfen daha sonra tekrar deneyin.', retryAfterSec: 3600 }
  }

  const code = generateCode()
  const expiresAt = new Date(Date.now() + CODE_TTL_MS)

  const tenantId = args.tenantId ?? null
  await db.phoneVerification.create({
    data: {
      tenantId,
      phone: normalized,
      code: hashCode(normalized, code),
      expiresAt,
      ipAddress: args.ipAddress ?? null,
    },
  })

  // Kod yalnız sağlayıcıya giden metindedir; teslim kaydında gövde saklanmaz (şablon anahtarı + sürüm), log'a yazılmaz (ADR-0047).
  const template = { key: 'phone_verification', version: 1 }
  const body = renderTemplate(template, { code })

  // Tenant context'i varsa delivery'i o tenant'a kaydet, yoksa public booking için
  // mock provider zaten herkes için çalışır — gerçek SMS sadece NETGSM_USERCODE varsa
  if (tenantId) {
    const { result } = await sendSms({
      tenantId,
      to: normalized,
      body,
      template,
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

  // Sayaç karşılaştırmadan ÖNCE ve atomik artar: eş zamanlı istekler 5 sınırını aşamaz.
  const counted = await db.phoneVerification.updateMany({
    where: { id: verification.id, attempts: { lt: MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  })
  if (counted.count === 0) {
    return { ok: false, error: 'TOO_MANY_ATTEMPTS', message: 'Çok fazla yanlış deneme. Yeni kod isteyin.' }
  }

  if (!safeEqualHex(verification.code, hashCode(normalized, args.code.trim()))) {
    return { ok: false, error: 'INVALID_CODE', message: 'Kod hatalı.' }
  }

  // Tek kullanımlık: eş zamanlı iki doğru istekten yalnız biri tüketir.
  const consumed = await db.phoneVerification.updateMany({
    where: { id: verification.id, consumedAt: null },
    data: { consumedAt: new Date() },
  })
  if (consumed.count === 0) {
    return { ok: false, error: 'NO_CODE', message: 'Doğrulama kodu bulunamadı. Önce kod isteyin.' }
  }

  return { ok: true, phone: normalized }
}
