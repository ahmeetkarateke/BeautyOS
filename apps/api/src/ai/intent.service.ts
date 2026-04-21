import { GoogleGenerativeAI, type Content } from '@google/generative-ai'
import { z } from 'zod'
import { logger } from '../lib/logger'
import type { Intent, BookingEntities, ConversationSession } from '../session/session.service'

// ─── AI çıktı şeması (Zod ile doğrulama) ────────────────────────────────────

const IntentResultSchema = z.object({
  intent: z.enum(['book', 'cancel', 'query_price', 'query_availability', 'general', 'unknown']),
  confidence: z.number().min(0).max(1),
  entities: z.object({
    service: z.string().optional(),
    staffPreference: z.string().optional(),
    datePreference: z.string().optional(),
    timePreference: z.string().optional(),
  }),
  requiresClarification: z.boolean(),
  clarificationQuestion: z.string().optional(),
})

export type IntentResult = z.infer<typeof IntentResultSchema>

// ─── Salon bağlamı (MVP'de statik, ileride DB'den gelecek) ───────────────────

export interface SalonContext {
  name: string
  services: Array<{ name: string; duration: number; price: number }>
  staff: Array<{ name: string; title: string }>
  workingHours: string
  address: string
}

// ─── Intent Servisi ───────────────────────────────────────────────────────────

export class IntentService {
  // Basit niyet + entity çıkarma için ekonomik model
  private readonly flashModel = 'gemini-2.5-flash'
  // Karmaşık diyalog, belirsiz girdi için güçlü model
  private readonly proModel = 'gemini-2.5-pro'
  // Güven eşiği — bu değerin altında netleştirme sorusu sorulur
  private readonly CONFIDENCE_THRESHOLD = 0.75

  constructor(private readonly genAI: GoogleGenerativeAI) {}

  private detectByKeyword(message: string, salon: SalonContext): IntentResult | null {
    const lower = message.toLowerCase().trim()

    const bookKeywords = ['randevu', 'rezervasyon', 'almak istiyorum', 'gelmek istiyorum', 'appointment']
    if (bookKeywords.some((k) => lower.includes(k))) {
      return { intent: 'book', confidence: 0.95, entities: {}, requiresClarification: false }
    }

    for (const service of salon.services) {
      if (lower.includes(service.name.toLowerCase())) {
        return {
          intent: 'book',
          confidence: 0.9,
          entities: { service: service.name },
          requiresClarification: false,
        }
      }
    }

    const cancelKeywords = ['iptal', 'cancel', 'vazgeçtim', 'gelmeyeceğim']
    if (cancelKeywords.some((k) => lower.includes(k))) {
      return { intent: 'cancel', confidence: 0.95, entities: {}, requiresClarification: false }
    }

    const priceKeywords = ['fiyat', 'ücret', 'kaç lira', 'kaç tl', 'ne kadar', 'fiyatlar']
    if (priceKeywords.some((k) => lower.includes(k))) {
      return { intent: 'query_price', confidence: 0.95, entities: {}, requiresClarification: false }
    }

    return null
  }

  async detect(
    session: ConversationSession,
    userMessage: string,
    salon: SalonContext,
  ): Promise<IntentResult> {
    // Keyword eşleşmesi varsa Gemini'ye gitme
    const keywordResult = this.detectByKeyword(userMessage, salon)
    if (keywordResult) return keywordResult

    // Karmaşık oturum (çok tur, belirsiz geçmiş) → güçlü model
    const modelName = session.turnCount > 4 || session.clarifyCount > 0
      ? this.proModel
      : this.flashModel

    const systemPrompt = buildSystemPrompt(salon)
    const userPrompt = buildDetectionPrompt(userMessage, session)
    const history = toGeminiHistory(session.messages.slice(-6))

    try {
      const model = this.genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 300,
          responseMimeType: 'application/json',
        },
      })

      const chat = model.startChat({ history })
      const result = await chat.sendMessage(userPrompt)
      const raw = result.response.text()

      const parsed = IntentResultSchema.safeParse(JSON.parse(raw))

      if (!parsed.success) {
        logger.warn({ raw, error: parsed.error }, 'Intent parse hatası, unknown dönüyor')
        return fallbackResult()
      }

      logger.debug(
        { intent: parsed.data.intent, confidence: parsed.data.confidence, model: modelName },
        'Intent tespit edildi',
      )

      return parsed.data
    } catch (error) {
      logger.error({ error }, 'Intent servisi hatası')
      return fallbackResult()
    }
  }

  // ─── Serbest yanıt üretme ─────────────────────────────────────────────────
  // Intent tespiti dışında — genel soru yanıtlama veya netleştirme mesajı

  async generateReply(
    session: ConversationSession,
    userMessage: string,
    salon: SalonContext,
    instruction: string,
  ): Promise<string> {
    const modelName = session.turnCount > 6 ? this.proModel : this.flashModel
    const history = toGeminiHistory(session.messages.slice(-8))

    try {
      const model = this.genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: `${buildSystemPrompt(salon)}\n\nGörev: ${instruction}. Türkçe, kısa (max 3 cümle), samimi yaz.`,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 200,
        },
      })

      const chat = model.startChat({ history })
      const result = await chat.sendMessage(userMessage)
      return result.response.text().trim() || FALLBACK_MESSAGE
    } catch (error) {
      logger.error({ error }, 'Yanıt üretme hatası')
      return FALLBACK_MESSAGE
    }
  }

  isLowConfidence(result: IntentResult): boolean {
    return result.confidence < this.CONFIDENCE_THRESHOLD
  }
}

// ─── OpenAI formatından Gemini formatına dönüştürme ──────────────────────────
// Gemini: role 'user' | 'model', ardışık aynı roller birleştirilir

function toGeminiHistory(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): Content[] {
  const result: Content[] = []

  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'model' : 'user'
    const last = result[result.length - 1]

    if (last && last.role === role) {
      last.parts.push({ text: msg.content })
    } else {
      result.push({ role, parts: [{ text: msg.content }] })
    }
  }

  return result
}

// ─── Prompt inşacıları ────────────────────────────────────────────────────────

function buildSystemPrompt(salon: SalonContext): string {
  // Menü JSON formatında — Markdown'a göre %40 daha az token
  const menu = salon.services
    .map((s) => `${s.name}(${s.duration}dk,₺${s.price})`)
    .join(', ')

  const staff = salon.staff.map((s) => `${s.name}/${s.title}`).join(', ')

  return `Sen ${salon.name} salonunun AI asistanısın. Müşterilerin WhatsApp/Telegram üzerinden randevu almasına yardım ediyorsun.

SALON: adres=${salon.address} | saat=${salon.workingHours}
MENÜ: ${menu}
PERSONEL: ${staff}

KURALLAR:
- Sadece Türkçe yanıt ver
- Maksimum 3 cümle
- Randevu kesinleşmeden asla "oluşturuldu" yazma
- Bilmediğin soruları salona yönlendir
- Fiyat söylerken "₺X'dan başlayan" kullan

NİYET TESPİT ÖRNEKLERİ:
"Tırnak" → book, service: tırnak hizmeti
"Merhaba saç kestirmek istiyorum" → book, service: saç kesimi
"Yarın müsait misiniz" → query_availability
"Ne kadar tutar" → query_price
"Merhaba" → general
"Teşekkürler" → general`
}

function buildDetectionPrompt(
  userMessage: string,
  session: ConversationSession,
): string {
  return `Kullanıcı mesajını analiz et ve JSON döndür:

Mesaj: "${userMessage}"
Mevcut adım: ${session.step}
Mevcut niyet: ${session.currentIntent ?? 'yok'}
Mevcut bilgiler: ${JSON.stringify(session.entities)}

JSON formatı:
{
  "intent": "book|cancel|query_price|query_availability|general|unknown",
  "confidence": 0.0-1.0,
  "entities": {
    "service": "varsa hizmet adı",
    "staffPreference": "varsa tercih edilen personel",
    "datePreference": "varsa tarih ifadesi (yarın, cumartesi, 15 haziran)",
    "timePreference": "varsa saat ifadesi (öğleden sonra, 14:00)"
  },
  "requiresClarification": true/false,
  "clarificationQuestion": "netleştirme sorusu (requiresClarification=true ise)"
}

Önemli: Selamlama (merhaba, selam), genel soru veya belirsiz ama anlamlı mesajlar için 'general' kullan, 'unknown' değil. Sadece anlamsız/spam mesajlar için 'unknown' döndür.`
}

function fallbackResult(): IntentResult {
  return {
    intent: 'unknown',
    confidence: 0,
    entities: {},
    requiresClarification: false,
  }
}

const FALLBACK_MESSAGE =
  'Şu an bir sorun yaşıyorum. Lütfen salonumuzu arayın veya birkaç dakika sonra tekrar deneyin.'

// ─── Boş salon bağlamı (test için) ───────────────────────────────────────────

export const TEST_SALON: SalonContext = {
  name: 'BeautyOS Test Salon',
  address: 'Test Mah. Demo Cad. No:1',
  workingHours: 'Hafta içi 09:00-20:00, Cumartesi 10:00-18:00',
  services: [
    { name: 'Saç Kesimi', duration: 30, price: 250 },
    { name: 'Röfle', duration: 90, price: 600 },
    { name: 'Komple Boyama', duration: 120, price: 900 },
    { name: 'Protez Tırnak', duration: 120, price: 450 },
    { name: 'Manikür', duration: 45, price: 200 },
    { name: 'Pedikür', duration: 60, price: 250 },
  ],
  staff: [
    { name: 'Ayşe Hanım', title: 'Kıdemli Kuaför' },
    { name: 'Emre Bey', title: 'Nail Artist' },
    { name: 'Zeynep Hanım', title: 'Estetisyen' },
  ],
}
