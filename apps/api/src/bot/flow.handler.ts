import { logger } from '../lib/logger'
import type { MessagingChannel, IncomingMessage } from '../channels/types'
import type { SessionService, ConversationSession } from '../session/session.service'
import type { IntentService, SalonContext } from '../ai/intent.service'
import {
  getAvailableSlots,
  createAppointment,
  cancelAppointmentByRef,
  type AvailableSlot,
} from './booking.service'

// ─── Eşikler ─────────────────────────────────────────────────────────────────
const HANDOFF_LIMIT = 5

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

function isAffirmative(text: string): boolean {
  const t = text.toLowerCase().trim()
  return ['evet', ' e ', 'yes', 'tamam', 'ok', 'onay', 'olur', 'oluyor', 'onaylıyorum'].some(
    (k) => t === k.trim() || t.includes(k),
  )
}

function isNegative(text: string): boolean {
  const t = text.toLowerCase().trim()
  return ['hayır', 'yok', 'no', 'iptal', 'vazgeç', 'istemiyorum'].some(
    (k) => t === k.trim() || t.includes(k),
  )
}

function matchSlot(input: string, slots: AvailableSlot[]): AvailableSlot | undefined {
  const t = input.trim().toLowerCase()

  // Numara ile ("1", "2" …)
  const num = parseInt(t)
  if (!isNaN(num) && num >= 1 && num <= slots.length) return slots[num - 1]

  // Saat ile ("14:00", "14", "14.00")
  const hourMatch = t.match(/(\d{1,2})[.:h]?(\d{2})?/)
  if (hourMatch) {
    const hh = hourMatch[1].padStart(2, '0')
    const mm = (hourMatch[2] ?? '00').padStart(2, '0')
    const found = slots.find((s) => s.label === `${hh}:${mm}` || s.label.startsWith(`${hh}:`))
    if (found) return found
  }

  // Personel adı ile
  return slots.find(
    (s) =>
      s.staffName.toLowerCase().includes(t) ||
      t.includes(s.staffName.toLowerCase().split(' ')[0]),
  )
}

function slotListText(slots: AvailableSlot[]): string {
  return slots.map((s, i) => `${i + 1}. ${s.label} — ${s.staffName}`).join('\n')
}

// "Hayır cumartesi istiyorum" gibi mesajlardan yeni tarih çıkar
function extractNewDate(text: string): string | null {
  const t = text.toLowerCase()
  const dateKeywords = [
    'yarın', 'yarin', 'bugün', 'bugun',
    'pazartesi', 'salı', 'sali', 'çarşamba', 'carsamba',
    'perşembe', 'persembe', 'cuma', 'cumartesi', 'pazar',
    'ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran',
    'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık',
  ]
  if (dateKeywords.some((k) => t.includes(k))) return text
  if (/\d{1,2}\s+[a-zışğüöç]{3,}/.test(t)) return text
  return null
}

// ─── Ana Flow Handler ─────────────────────────────────────────────────────────

export class FlowHandler {
  constructor(
    private readonly sessionService: SessionService,
    private readonly intentService: IntentService,
  ) {}

  async handle(
    channel: MessagingChannel,
    msg: IncomingMessage,
    salon: SalonContext,
    tenantId: string,
  ): Promise<void> {
    const session = await this.sessionService.getOrCreate(tenantId, msg.channelType, msg.from)
    this.sessionService.addMessage(session, 'user', msg.text)

    logger.info(
      { from: msg.from, step: session.step, turn: session.turnCount, text: msg.text },
      'Mesaj alındı',
    )

    try {
      await this.route(channel, msg, session, salon)
    } catch (error) {
      logger.error({ error, from: msg.from }, 'Flow handler hatası')
      await channel.sendText(msg.from, 'Bir sorun oluştu, lütfen tekrar deneyin.')
    }

    await this.sessionService.save(session)
  }

  // ─── Yönlendirici ─────────────────────────────────────────────────────────

  private async route(
    channel: MessagingChannel,
    msg: IncomingMessage,
    session: ConversationSession,
    salon: SalonContext,
  ): Promise<void> {
    // /start veya yeni oturum → karşılama
    if (msg.text === '/start' || (session.turnCount === 1 && session.step === 'idle')) {
      await this.sessionService.reset(session)
      const top3 = salon.services.slice(0, 3).map((s) => s.name).join(', ')
      const welcome = `Merhaba! 👋 Ben *${salon.name}* salonunun asistanıyım. Size nasıl yardımcı olabilirim?\n\nPopüler hizmetlerimiz: ${top3}`
      await channel.sendText(msg.from, welcome)
      return
    }

    if (session.step === 'handed_off') return

    // Aktif randevu akışı devam ediyorsa
    if (session.currentIntent === 'book' && session.step !== 'idle') {
      await this.handleBookingStep(channel, msg, session, salon)
      return
    }

    if (session.currentIntent === 'cancel' && session.step !== 'idle') {
      await this.handleCancelStep(channel, msg, session)
      return
    }

    // Yeni niyet tespiti
    const result = await this.intentService.detect(session, msg.text, salon)
    logger.info({ intent: result.intent, confidence: result.confidence }, 'Intent tespit')

    if (session.clarifyCount >= HANDOFF_LIMIT) {
      session.step = 'handed_off'
      await channel.sendText(
        msg.from,
        `🙏 Sizi salonumuzla bağlantı kurayım. Birkaç dakika içinde size dönecekler.\n\nAdres: ${salon.address}`,
      )
      return
    }

    if (result.intent === 'unknown') {
      session.clarifyCount++
      await channel.sendText(
        msg.from,
        'Anlayamadım. Randevu almak, fiyat öğrenmek veya randevu iptal etmek için yazabilirsiniz.',
      )
      return
    }

    session.clarifyCount = 0
    session.currentIntent = result.intent
    if (result.entities) Object.assign(session.entities, result.entities)

    switch (result.intent) {
      case 'book':
        await this.startBooking(channel, msg, session, salon)
        break
      case 'cancel':
        await this.startCancel(channel, msg, session)
        break
      case 'query_price':
        await this.handlePriceQuery(channel, msg, salon)
        await this.sessionService.reset(session)
        break
      case 'query_availability':
      case 'general': {
        const instruction =
          result.intent === 'query_availability'
            ? 'Müsaitlik sorusunu yanıtla, randevu almak istiyorsa yönlendir'
            : 'Genel soruyu yanıtla, bilmiyorsan salona yönlendir'
        const reply = await this.intentService.generateReply(session, msg.text, salon, instruction)
        this.sessionService.addMessage(session, 'assistant', reply)
        await channel.sendText(msg.from, reply)
        await this.sessionService.reset(session)
        break
      }
    }
  }

  // ─── Randevu Başlat ───────────────────────────────────────────────────────

  private async startBooking(
    channel: MessagingChannel,
    msg: IncomingMessage,
    session: ConversationSession,
    salon: SalonContext,
  ): Promise<void> {
    if (session.entities.service) {
      session.step = 'awaiting_date'
      await channel.sendText(
        msg.from,
        `*${session.entities.service}* için randevu alalım! Ne zaman gelmek istersiniz?\n\n(Örnek: "yarın", "Cumartesi öğleden sonra", "Pazartesi saat 14")`,
      )
      return
    }

    session.step = 'awaiting_service'
    const list = salon.services.map((s, i) => `${i + 1}. ${s.name} — ${s.duration} dk / ₺${s.price}'dan`).join('\n')
    await channel.sendText(msg.from, `Hangi hizmetimizden randevu almak istersiniz?\n\n${list}\n\nHizmet adını veya numarasını yazabilirsiniz.`)
  }

  // ─── Randevu Adımları ─────────────────────────────────────────────────────

  private async handleBookingStep(
    channel: MessagingChannel,
    msg: IncomingMessage,
    session: ConversationSession,
    salon: SalonContext,
  ): Promise<void> {
    switch (session.step) {

      case 'awaiting_service': {
        const num = parseInt(msg.text.trim())
        let matched = !isNaN(num) && num >= 1 && num <= salon.services.length
          ? salon.services[num - 1]
          : salon.services.find((s) =>
              msg.text.toLowerCase().includes(s.name.toLowerCase()) ||
              s.name.toLowerCase().includes(msg.text.toLowerCase().trim()),
            )

        if (!matched) {
          // Gemini ile çözmeyi dene
          const r = await this.intentService.detect(session, msg.text, salon)
          if (r.entities?.service) {
            matched = salon.services.find((s) =>
              s.name.toLowerCase().includes(r.entities!.service!.toLowerCase()),
            )
          }
        }

        if (!matched) {
          const list = salon.services.map((s, i) => `${i + 1}. ${s.name}`).join('\n')
          await channel.sendText(msg.from, `Bu hizmeti bulamadım. Lütfen listeden seçin:\n\n${list}`)
          return
        }

        session.entities.service = matched.name
        session.step = 'awaiting_date'
        await channel.sendText(
          msg.from,
          `*${matched.name}* için ne zaman gelmek istersiniz?\n\n(Örnek: "yarın", "Cumartesi öğleden sonra", "bugün saat 15")`,
        )
        break
      }

      case 'awaiting_date': {
        session.entities.datePreference = msg.text
        const slots = await getAvailableSlots(
          session.tenantId,
          session.entities.service ?? '',
          msg.text,
          msg.text,
        )

        if (slots.length === 0) {
          await channel.sendText(
            msg.from,
            'Bu tarih için uygun saat bulunamadı. Başka bir gün dener misiniz?',
          )
          return
        }

        ;(session.entities as Record<string, unknown>)['_slots'] = slots
        session.step = 'awaiting_slot_confirm'

        // Hangi tarih için olduğunu göster
        const dateLabel = slots[0].id.split('__')[0].split('T')[0]
        await channel.sendText(
          msg.from,
          `*${dateLabel}* için uygun saatler:\n\n${slotListText(slots)}\n\nHangisini tercih edersiniz? (numara veya saati yazabilirsiniz)`,
        )
        break
      }

      case 'awaiting_slot_confirm': {
        const storedSlots = (session.entities as Record<string, unknown>)['_slots'] as AvailableSlot[] | undefined
        if (!storedSlots?.length) {
          session.step = 'awaiting_date'
          await channel.sendText(msg.from, 'Bir sorun oluştu, tarih seçimini tekrar yapar mısınız?')
          return
        }

        // Kullanıcı yeni tarih söylüyorsa saat listesine geri dön
        const newDate = extractNewDate(msg.text)
        if (newDate) {
          session.entities.datePreference = newDate
          session.step = 'awaiting_date'
          await this.handleBookingStep(channel, msg, session, salon)
          return
        }

        const slot = matchSlot(msg.text, storedSlots)
        if (!slot) {
          const dateLabel = storedSlots[0].id.split('__')[0].split('T')[0]
          await channel.sendText(
            msg.from,
            `Anlayamadım. *${dateLabel}* için uygun saatler:\n\n${slotListText(storedSlots)}\n\nNumara veya saat yazın, ya da farklı bir tarih belirtin.`,
          )
          return
        }

        session.entities.confirmedSlot = slot.id
        ;(session.entities as Record<string, unknown>)['_selectedStaff'] = slot.staffName
        ;(session.entities as Record<string, unknown>)['_selectedTime'] = slot.label

        const [datePart, timePart] = slot.id.split('__')[0].split('T')
        const displayDate = datePart
        const displayTime = slot.label

        session.step = 'awaiting_confirm'
        const confirmText =
          `Randevuyu onaylıyor musunuz?\n\n` +
          `📋 *${session.entities.service}*\n` +
          `📅 ${displayDate} saat ${displayTime}\n` +
          `👤 ${slot.staffName}\n\n` +
          `"evet" veya "hayır" yazın.`
        await channel.sendText(msg.from, confirmText)
        break
      }

      case 'awaiting_confirm': {
        // Kullanıcı yeni tarih söylüyorsa (örn: "Hayır ben 22 nisanda gelecem")
        const newDateAtConfirm = extractNewDate(msg.text)
        if (newDateAtConfirm && !isAffirmative(msg.text)) {
          session.entities.datePreference = newDateAtConfirm
          session.step = 'awaiting_date'
          await this.handleBookingStep(channel, msg, session, salon)
          return
        }

        if (isAffirmative(msg.text)) {
          await this.confirmBooking(channel, msg, session)
        } else if (isNegative(msg.text)) {
          await channel.sendText(msg.from, 'Tamam, randevuyu iptal ettim. Başka bir konuda yardımcı olabilir miyim?')
          await this.sessionService.reset(session)
        } else {
          const staff = (session.entities as Record<string, unknown>)['_selectedStaff'] as string ?? ''
          const time = (session.entities as Record<string, unknown>)['_selectedTime'] as string ?? ''
          const date = session.entities.confirmedSlot?.split('__')[0].split('T')[0] ?? ''
          await channel.sendText(
            msg.from,
            `Onaylamak için "evet", iptal etmek için "hayır" yazın.\n\n📋 *${session.entities.service}*\n📅 ${date} saat ${time}\n👤 ${staff}`,
          )
        }
        break
      }
    }
  }

  // ─── Randevu Onayla & Kaydet ──────────────────────────────────────────────

  private async confirmBooking(
    channel: MessagingChannel,
    msg: IncomingMessage,
    session: ConversationSession,
  ): Promise<void> {
    const slotId = session.entities.confirmedSlot ?? ''
    const service = session.entities.service ?? ''
    const staffName = ((session.entities as Record<string, unknown>)['_selectedStaff'] as string) ?? 'Uygun Uzman'
    const displayTime = ((session.entities as Record<string, unknown>)['_selectedTime'] as string) ?? ''

    let ref: string
    try {
      if (slotId.includes('mock-staff')) {
        ref = `RDV-${Date.now().toString(36).toUpperCase()}`
      } else {
        ref = await createAppointment({
          tenantId: session.tenantId,
          customerPhone: session.from,
          customerName: session.from,
          serviceName: service,
          slotId,
          channel: session.channelType === 'telegram' ? 'telegram' : 'whatsapp',
        })
      }
    } catch (error) {
      logger.error({ error, slotId }, 'Randevu kaydetme hatası')
      await channel.sendText(msg.from, '❌ Randevu oluşturulurken bir sorun oluştu. Lütfen tekrar deneyin.')
      return
    }

    const dateStr = slotId.split('__')[0].split('T')[0]
    const reply =
      `✅ Randevunuz oluşturuldu!\n\n` +
      `📋 *${service}*\n` +
      `📅 ${dateStr} saat ${displayTime}\n` +
      `👤 ${staffName}\n` +
      `🔖 Referans: \`${ref}\`\n\n` +
      `Sizi bekliyoruz! 🌸`

    this.sessionService.addMessage(session, 'assistant', reply)
    await channel.sendText(msg.from, reply)
    await this.sessionService.reset(session)
  }

  // ─── İptal Akışı ──────────────────────────────────────────────────────────

  private async startCancel(
    channel: MessagingChannel,
    msg: IncomingMessage,
    session: ConversationSession,
  ): Promise<void> {
    session.step = 'awaiting_cancel_confirm'
    await channel.sendText(msg.from, 'İptal etmek istediğiniz randevunuzun referans kodunu yazar mısınız? (Örnek: RDV-ABC123)')
  }

  private async handleCancelStep(
    channel: MessagingChannel,
    msg: IncomingMessage,
    session: ConversationSession,
  ): Promise<void> {
    const refCode = msg.text.trim().toUpperCase()
    const cancelled = await cancelAppointmentByRef(session.tenantId, refCode)

    const reply = cancelled
      ? '✅ Randevunuz iptal edildi. Görüşmek üzere! 👋'
      : `"${refCode}" referans kodlu aktif randevu bulunamadı. Lütfen kontrol edip tekrar deneyin.`

    this.sessionService.addMessage(session, 'assistant', reply)
    await channel.sendText(msg.from, reply)
    await this.sessionService.reset(session)
  }

  // ─── Fiyat Sorgusu ────────────────────────────────────────────────────────

  private async handlePriceQuery(
    channel: MessagingChannel,
    msg: IncomingMessage,
    salon: SalonContext,
  ): Promise<void> {
    const list = salon.services.map((s) => `• ${s.name}: ₺${s.price}'dan başlayan`).join('\n')
    await channel.sendText(msg.from, `💰 *Fiyat Listemiz:*\n\n${list}`)
  }
}
