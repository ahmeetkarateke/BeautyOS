import { db } from './db'
import { logger } from './logger'

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 saat

interface CacheEntry {
  value: string
  expiresAt: number
}

export class TenantRegistry {
  private cache = new Map<string, CacheEntry>()

  private get(key: string): string | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) { this.cache.delete(key); return null }
    return entry.value
  }

  private set(key: string, value: string): void {
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
  }

  // ─── Telegram bot token'ı → tenantId ─────────────────────────────────────

  async getByBotToken(botToken: string): Promise<string | null> {
    const cacheKey = `bot:${botToken.slice(-8)}`
    const cached = this.get(cacheKey)
    if (cached) return cached

    const tenant = await db.tenant.findFirst({
      where: { telegramBotToken: botToken, isActive: true },
      select: { id: true },
    })

    if (!tenant) {
      logger.warn({ tokenSuffix: botToken.slice(-8) }, 'Tenant bulunamadı (bot token)')
      return null
    }

    this.set(cacheKey, tenant.id)
    return tenant.id
  }

  // ─── WhatsApp phoneNumberId → tenantId ───────────────────────────────────

  async getByPhoneNumberId(phoneNumberId: string): Promise<string | null> {
    const cacheKey = `wa:${phoneNumberId}`
    const cached = this.get(cacheKey)
    if (cached) return cached

    const tenant = await db.tenant.findFirst({
      where: { isActive: true },
      select: { id: true },
    })

    if (!tenant) return null

    this.set(cacheKey, tenant.id)
    return tenant.id
  }

  // ─── Env var fallback ─────────────────────────────────────────────────────

  static fromEnv(): string | null {
    return process.env.TELEGRAM_TENANT_ID ?? null
  }
}
