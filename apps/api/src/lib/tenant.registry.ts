import type Redis from 'ioredis'
import { db } from './db'
import { logger } from './logger'

const CACHE_TTL = 60 * 60 // 1 saat — tenant config nadiren değişir
const KEY_PREFIX = 'beautyos:tenant'

export class TenantRegistry {
  constructor(private readonly redis: Redis) {}

  // ─── Telegram bot token'ı → tenantId ─────────────────────────────────────────
  // Her Railway deployment tek bir bot token çalıştırır.
  // Çok-tenant deployment'ta her tenant kendi pod'unda çalışır.

  async getByBotToken(botToken: string): Promise<string | null> {
    const cacheKey = `${KEY_PREFIX}:bot:${botToken.slice(-8)}` // token'ın son 8 karakteri yeterli
    const cached = await this.redis.get(cacheKey)
    if (cached) return cached

    const tenant = await db.tenant.findFirst({
      where: { telegramBotToken: botToken, isActive: true },
      select: { id: true },
    })

    if (!tenant) {
      logger.warn({ tokenSuffix: botToken.slice(-8) }, 'Tenant bulunamadı (bot token)')
      return null
    }

    await this.redis.setex(cacheKey, CACHE_TTL, tenant.id)
    return tenant.id
  }

  // ─── WhatsApp phoneNumberId → tenantId ───────────────────────────────────────

  async getByPhoneNumberId(phoneNumberId: string): Promise<string | null> {
    const cacheKey = `${KEY_PREFIX}:wa:${phoneNumberId}`
    const cached = await this.redis.get(cacheKey)
    if (cached) return cached

    const tenant = await db.tenant.findFirst({
      where: { isActive: true },
      select: { id: true, settings: true },
    })

    // MVP: tek tenant — ileride TENANT_PHONE_REGISTRY tablosu ile genişletilir
    if (!tenant) return null

    await this.redis.setex(cacheKey, CACHE_TTL, tenant.id)
    return tenant.id
  }

  // ─── Env var fallback: TELEGRAM_TENANT_ID set edilmişse direkt döndür ─────────
  // Tek-tenant deployment için en hızlı yol (DB + Redis'e gitmeye gerek yok)

  static fromEnv(): string | null {
    return process.env.TELEGRAM_TENANT_ID ?? null
  }
}
