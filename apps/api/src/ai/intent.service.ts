import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'
import { logger } from '../lib/logger'
import type { Intent, BookingEntities, ConversationSession } from '../session/session.service'

// ─── AI çıktı şeması (Zod ile doğrulama) ────────────────────────────────────

const IntentResultSchema = z.object({
  intent: z.enum(['book', 'cancel', 'query_price', 'query_availability', 'general', 'unknown']),
  confidence: z.number().min(0).max(1),
  entities: z.object({
    service: z.string().nullable().optional(),
    staffPreference: z.string().nullable().optional(),
    datePreference: z.string().nullable().optional(),
    timePreference: z.string().nullable().optional(),
  }).optional().default({}),
  requiresClarification: z.boolean().optional().default(false),
  clarificationQuestion: z.string().nullable().optional(),
})

export type IntentResult = z.infer<typeof IntentResultSchema>

// ─── Salon bağlamı (MVP'de statik, ileride DB'den gelecek) ───────────────────

export interface SalonContext {
  name: string
  services: Array<{ name: string; duration: number; price: number }>
  staff: Array<{ name: string; title: string }>
  workingHours: string
  address: string
  phone?: string
  botIntro?: string
  botTone?: 'formal' | 'friendly' | 'energetic'
  botRules?: string
  botFaqs?: Array<{ question: string; answer: string }>
  botHidePrices?: boolean
}

// ─── Intent Servisi ───────────────────────────────────────────────────────────

export class IntentService {
  private readonly flashModel = 'gemini-2.5-flash'
  private readonly proModel = 'gemini-2.5-flash'
  // Güven eşiği — bu değerin altında netleştirme sorusu sorulur
  private readonly CONFIDENCE_THRESHOLD = 0.75

  constructor(private readonly genAI: GoogleGenerativeAI) {}

  async detect(
    session: ConversationSession,
    userMessage: string,
    salon: SalonContext,
  ): Promise<IntentResult> {
    const modelName = session.turnCount > 4 || session.clarifyCount > 0
      ? this.proModel
      : this.flashModel

    // Detection için tek seferlik generateContent — chat/history karmaşasını önler
    const prompt = buildDetectionPrompt(userMessage, session, salon)

    try {
      const model = this.genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 800,
          // @ts-ignore — thinkingBudget is valid for gemini-2.5 but not in SDK types yet
          thinkingConfig: { thinkingBudget: 0 },
        },
      })

      const result = await model.generateContent(prompt)
      const raw = result.response.text()
      logger.info({ raw, userMessage, model: modelName }, 'Gemini RAW response')

      // JSON objesini response içinde ara — model öncesine/sonrasına metin ekleyebilir
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        logger.warn({ raw }, 'Gemini JSON objesi bulunamadı')
        return fallbackResult()
      }
      const parsed = IntentResultSchema.safeParse(JSON.parse(jsonMatch[0]))

      if (!parsed.success) {
        logger.warn({ raw, zodError: parsed.error.flatten() }, 'Gemini JSON parse hatası')
        return fallbackResult()
      }

      logger.debug(
        { intent: parsed.data.intent, confidence: parsed.data.confidence, model: modelName },
        'Intent tespit edildi',
      )

      return parsed.data
    } catch (error) {
      logger.error({ error, model: modelName, message: userMessage }, 'Gemini API hatası — tam hata:')
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

    try {
      const model = this.genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 400,
          // @ts-ignore
          thinkingConfig: { thinkingBudget: 0 },
        },
      })

      const prompt = `${buildSystemPrompt(salon)}\n\nGörev: ${instruction}. Türkçe, kısa (max 3 cümle), samimi yaz.\n\nKullanıcı: ${userMessage}`
      const result = await model.generateContent(prompt)
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

// ─── Prompt inşacıları ────────────────────────────────────────────────────────

function buildSystemPrompt(salon: SalonContext): string {
  const menu = salon.botHidePrices
    ? salon.services.map((s) => `${s.name}|${s.duration}dk`).join(', ')
    : salon.services.map((s) => `${s.name}|${s.duration}dk|₺${s.price}`).join(', ')
  const staff = salon.staff.map((s) => s.name).join(', ')

  const toneMap = { formal: 'Resmi ve profesyonel', friendly: 'Samimi ve sıcak', energetic: 'Enerjik ve canlı' }
  const tone = salon.botTone ? toneMap[salon.botTone] : 'Samimi'

  const lines: string[] = [
    `Sen ${salon.name} adlı işletmenin randevu asistanısın. Türkçe, kısa (max 3 cümle) yanıt ver.`,
  ]

  if (salon.botHidePrices) {
    lines.push(`[ZORUNLU KURAL] Hiçbir koşulda fiyat, ücret veya tutar bilgisi verme. Fiyat sorulursa SADECE "Fiyatlarımız için lütfen salonumuzu arayın." de, başka bir şey söyleme.`)
  }

  if (salon.botIntro) lines.push(salon.botIntro)

  lines.push(`SALON: ${salon.address} | ${salon.workingHours}`)
  lines.push(`MENÜ: ${menu}`)
  lines.push(`PERSONEL: ${staff}`)
  lines.push(salon.botRules
    ? `KURALLAR: ${salon.botRules}`
    : `KURALLAR: Randevu kesinleşmeden "oluşturuldu" yazma. Bilmediğin soruları salona yönlendir. Ne istediği belirsizse sor.`)
  lines.push(`TON: ${tone}`)

  if (salon.botFaqs?.length) {
    const faqText = salon.botFaqs.map((f) => `S: ${f.question}\nC: ${f.answer}`).join('\n')
    lines.push(`SSS:\n${faqText}`)
  }

  const prompt = lines.join('\n')
  logger.info({ tokens: prompt.split(' ').length }, 'buildSystemPrompt token tahmini')
  return prompt
}

function buildDetectionPrompt(
  userMessage: string,
  session: ConversationSession,
  salon: SalonContext,
): string {
  const serviceNames = salon.services.map((s) => s.name).join(', ')

  const prompt = `Güzellik salonu rezervasyon botu. Mesajı analiz et, SADECE JSON döndür.

HİZMETLER: ${serviceNames}
ADIM: ${session.step} | NİYET: ${session.currentIntent ?? 'yok'}
MESAJ: "${userMessage}"

FORMAT: {"intent":"book|cancel|query_price|query_availability|general|unknown","confidence":0.0-1.0,"entities":{"service":null,"staffPreference":null,"datePreference":null,"timePreference":null},"requiresClarification":false}

ÖRNEKLER:
"merhaba" → {"intent":"general","confidence":0.95,"entities":{},"requiresClarification":false}
"saç kestirmek istiyorum" → {"intent":"book","confidence":0.95,"entities":{"service":"Saç Kesimi"},"requiresClarification":false}
"iptal etmek istiyorum" → {"intent":"cancel","confidence":0.95,"entities":{},"requiresClarification":false}
"ne kadar tutar" → {"intent":"query_price","confidence":0.9,"entities":{},"requiresClarification":false}

KURALLAR: selamlama/teşekkür → general | anlamsız/spam → unknown`

  logger.info({ tokens: prompt.split(' ').length }, 'buildDetectionPrompt token tahmini')
  return prompt
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
