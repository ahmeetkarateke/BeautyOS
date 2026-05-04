import { db } from '../lib/db'
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
  | 'awaiting_confirm'
  | 'awaiting_cancel_confirm'
  | 'completed'
  | 'handed_off'

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
  clarifyCount: number   // Netleştirme sayısı
  step: FlowStep
  createdAt: string
  lastMessageAt: string
}

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const SESSION_TTL_HOURS = 23  // WhatsApp penceresiyle uyumlu
const MAX_HISTORY = 20

// ─── Session Servisi (PostgreSQL) ─────────────────────────────────────────────

export class SessionService {
  private buildKey(tenantId: string, channelType: ChannelType, from: string): string {
    return `${tenantId}:${channelType}:${from}`
  }

  // ─── Oturum alma/oluşturma ─────────────────────────────────────────────────

  async getOrCreate(
    tenantId: string,
    channelType: ChannelType,
    from: string,
  ): Promise<ConversationSession> {
    const key = this.buildKey(tenantId, channelType, from)
    const now = new Date()

    const row = await db.botSession.findUnique({ where: { id: key } })

    if (row && new Date(row.expiresAt) > now) {
      return row.data as unknown as ConversationSession
    }

    // Süresi dolmuş veya yok — yeni oturum oluştur
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
      createdAt: now.toISOString(),
      lastMessageAt: now.toISOString(),
    }

    await this.persist(key, tenantId, channelType, from, session)
    return session
  }

  // ─── Kaydetme ──────────────────────────────────────────────────────────────

  async save(session: ConversationSession): Promise<void> {
    session.lastMessageAt = new Date().toISOString()

    if (session.messages.length > MAX_HISTORY) {
      session.messages = session.messages.slice(-MAX_HISTORY)
    }

    await this.persist(
      session.sessionId,
      session.tenantId,
      session.channelType,
      session.from,
      session,
    )
  }

  private async persist(
    key: string,
    tenantId: string,
    channelType: string,
    fromRef: string,
    data: ConversationSession,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000)
    await db.botSession.upsert({
      where: { id: key },
      create: { id: key, tenantId, channelType, fromRef, data: data as object, expiresAt },
      update: { data: data as object, expiresAt },
    })
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

  // ─── Oturumu sıfırla ──────────────────────────────────────────────────────

  async reset(session: ConversationSession, outcome: 'booked' | 'cancelled' | 'handoff' | 'abandoned' = 'abandoned', referenceCode?: string): Promise<void> {
    this.persistConversation(session, outcome, referenceCode).catch((err) =>
      logger.warn({ err }, 'BotConversation DB kaydı başarısız'),
    )

    session.currentIntent = null
    session.entities = {}
    session.step = 'idle'
    session.clarifyCount = 0
    await this.save(session)
  }

  private async persistConversation(
    session: ConversationSession,
    outcome: string,
    referenceCode?: string,
  ): Promise<void> {
    if (session.messages.length === 0) return

    const messagesWithTs = session.messages.map((m, i) => ({ ...m, ts: i }))

    await db.botConversation.create({
      data: {
        tenantId: session.tenantId,
        channel: session.channelType,
        customerRef: session.from,
        messages: messagesWithTs,
        outcome,
        referenceCode: referenceCode ?? null,
        turnCount: session.turnCount,
        startedAt: new Date(session.createdAt),
      },
    })
  }

  async delete(tenantId: string, channelType: ChannelType, from: string): Promise<void> {
    const key = this.buildKey(tenantId, channelType, from)
    await db.botSession.delete({ where: { id: key } }).catch(() => {})
  }
}
