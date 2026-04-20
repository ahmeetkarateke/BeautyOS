import Redis from 'ioredis'
import { logger } from '../lib/logger'
import type { ChannelType } from '../channels/types'

// ─── Oturum veri modeli ───────────────────────────────────────────────────────

export type Intent =
  | 'book'
  | 'cancel'
  | 'query_price'
  | 'query_availability'
  | 'general'
  | 'unknown'

export type FlowStep =
  | 'idle'
  | 'awaiting_service'
  | 'awaiting_staff'
  | 'awaiting_date'
  | 'awaiting_time'
  | 'awaiting_slot_confirm'
  | 'awaiting_cancel_confirm'
  | 'completed'
  | 'handed_off' // insan devreye girdi

export interface BookingEntities {
  service?: string
  staffPreference?: string
  datePreference?: string
  timePreference?: string
  confirmedSlot?: string // "2025-06-21T14:00:00"
}

export interface ConversationSession {
  sessionId: string
  tenantId: string
  channelType: ChannelType
  from: string
  currentIntent: Intent | null
  entities: Partial<BookingEntities>
  // Son MAX_HISTORY mesaj — AI context için
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  turnCount: number      // Toplam tur sayısı
  clarifyCount: number   // Netleştirme sayısı (3 katman için)
  step: FlowStep
  createdAt: string
  lastMessageAt: string
}

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const SESSION_TTL_SECONDS = 23 * 60 * 60 // 23 saat (WhatsApp penceresiyle uyumlu)
const MAX_HISTORY = 20                     // AI'ya gönderilecek max mesaj
const KEY_PREFIX = 'beautyos:session'

// ─── Session Servisi ──────────────────────────────────────────────────────────

export class SessionService {
  private redis: Redis

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    })

    this.redis.on('error', (err) => logger.error({ err }, 'Redis bağlantı hatası'))
  }

  async connect(): Promise<void> {
    await this.redis.connect()
    logger.info('Redis bağlantısı kuruldu')
  }

  // ─── Oturum alma/oluşturma ─────────────────────────────────────────────────

  async getOrCreate(
    tenantId: string,
    channelType: ChannelType,
    from: string,
  ): Promise<ConversationSession> {
    const key = this.buildKey(tenantId, channelType, from)
    const raw = await this.redis.get(key)

    if (raw) {
      return JSON.parse(raw) as ConversationSession
    }

    const session: ConversationSession = {
      sessionId: key,
      tenantId,
      channelType,
      from,
      currentIntent: null,
      entities: {},
      messages: [],
      turnCount: 0,
      clarifyCount: 0,
      step: 'idle',
      createdAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
    }

    await this.save(session)
    return session
  }

  // ─── Kaydetme ──────────────────────────────────────────────────────────────

  async save(session: ConversationSession): Promise<void> {
    const key = this.buildKey(session.tenantId, session.channelType, session.from)
    session.lastMessageAt = new Date().toISOString()

    // Mesaj geçmişini kırp (bağlam penceresini kontrol altında tut)
    if (session.messages.length > MAX_HISTORY) {
      session.messages = session.messages.slice(-MAX_HISTORY)
    }

    await this.redis.setex(key, SESSION_TTL_SECONDS, JSON.stringify(session))
  }

  // ─── Mesaj ekleme ──────────────────────────────────────────────────────────

  addMessage(
    session: ConversationSession,
    role: 'user' | 'assistant',
    content: string,
  ): void {
    session.messages.push({ role, content })
    session.turnCount++
  }

  // ─── Oturumu sıfırla (işlem tamamlandı veya handoff) ──────────────────────

  async reset(session: ConversationSession): Promise<void> {
    session.currentIntent = null
    session.entities = {}
    session.step = 'idle'
    session.clarifyCount = 0
    // turnCount sıfırlanmaz — toplam konuşma sayısını tutar
    await this.save(session)
  }

  async delete(tenantId: string, channelType: ChannelType, from: string): Promise<void> {
    const key = this.buildKey(tenantId, channelType, from)
    await this.redis.del(key)
  }

  // ─── Yardımcı ─────────────────────────────────────────────────────────────

  private buildKey(tenantId: string, channelType: ChannelType, from: string): string {
    return `${KEY_PREFIX}:${tenantId}:${channelType}:${from}`
  }

  async ping(): Promise<boolean> {
    try {
      await this.redis.ping()
      return true
    } catch {
      return false
    }
  }
}
