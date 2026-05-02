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

  // Personel adı ile — min 3 karakter kontrolü (kısa test isimlerinin yanlış eşleşmesini önler)
  return slots.find((s) => {
    const name = s.staffName.toLowerCase()
    const firstName = name.split(' ')[0]
    if (firstName.length < 3) return false
    return name.includes(t) || t.includes(firstName)
  })
}

function slotListText(slots: AvailableSlot[]): string {
  return slots.map((s, i) => `${i + 1}. ${s.label} — ${s.staffName}`).join('\n')
}

function formatDateTR(dateStr: string): string {
  const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
  const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
  const d = new Date(`${dateStr}T00:00:00Z`)
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${days[d.getUTCDay()]}`
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
      await this.handleCancelStep(channel, msg, session, salon)
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
        // "Hangi gün?" / "Ne zaman müsaitsiniz?" gibi soru kalıpları — gün belirtmeden geliyor
        const isDateQuestion = /hangi (gün|günler|zaman)|ne zaman (müsait|var|uygun)|müsait (gün|günler)|randevu (var mı|varmı|müsait)/.test(msg.text.toLowerCase())
        if (isDateQuestion) {
          await channel.sendText(
            msg.from,
            `Pazartesi'den Cumartesi'ye randevu alabilirsiniz. Hangi günü tercih edersiniz?`,
          )
          return
        }

        session.entities.datePreference = msg.text
        const slots = await getAvailableSlots(
          session.tenantId,
          session.entities.service ?? '',
          msg.text,
          msg.text,
        )

        if (slots.length === 0) {
          const svc = session.entities.service ?? 'Bu hizmet'
          await channel.sendText(
            msg.from,
            `${svc} için bu tarihte müsait personelimiz bulunmuyor, başka bir gün tercih eder misiniz?`,
          )
          return
        }

        ;(session.entities as Record<string, unknown>)['_slots'] = slots
        session.step = 'awaiting_slot_confirm'

        // Hangi tarih için olduğunu göster
        const dateLabel = formatDateTR(slots[0].id.split('__')[0].split('T')[0])
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

        // "Daha geç saat var mı?" gibi sorular
        const t = msg.text.toLowerCase()
        const isAskingForDifferentTime = /daha (geç|erken|ileride|sonra|önce)|başka (saat|zaman|vakit)|geç.*saat|erken.*saat/.test(t)
        if (isAskingForDifferentTime) {
          const dateLabel = formatDateTR(storedSlots[0].id.split('__')[0].split('T')[0])
          const lastSlot = storedSlots[storedSlots.length - 1]
          await channel.sendText(
            msg.from,
            `${dateLabel} için en geç ${lastSlot.label} saatimiz müsait. Mevcut saatler:\n\n${slotListText(storedSlots)}\n\nBaşka bir gün tercih etmek ister misiniz?`,
          )
          return
        }

        const slot = matchSlot(msg.text, storedSlots)
        if (!slot) {
          // Soru mu yoksa saat seçimi mi? Soru gibiyse Gemini ile cevapla, sonra slotları tekrar göster
          const looksLikeQuestion = msg.text.includes('?') || /nasıl|nedir|nerede|kaç|kim|ne (kadar|zaman|oluyor)|çalışma saati/.test(t)
          if (looksLikeQuestion) {
            const reply = await this.intentService.generateReply(session, msg.text, salon, 'Genel soruyu yanıtla, sonra randevu saati seçimine geri dön')
            await channel.sendText(msg.from, reply)
          }
          const dateLabel = formatDateTR(storedSlots[0].id.split('__')[0].split('T')[0])
          await channel.sendText(
            msg.from,
            `*${dateLabel}* için uygun saatler:\n\n${slotListText(storedSlots)}\n\nNumara veya saat yazın, ya da farklı bir tarih belirtin.`,
          )
          return
        }

        session.entities.confirmedSlot = slot.id
        ;(session.entities as Record<string, unknown>)['_selectedStaff'] = slot.staffName
        ;(session.entities as Record<string, unknown>)['_selectedTime'] = slot.label

        const [datePart] = slot.id.split('__')[0].split('T')
        const displayDate = formatDateTR(datePart)
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
    ;(session.entities as Record<string, unknown>)['_cancelAttempts'] = 0
    await channel.sendText(
      msg.from,
      'Son randevunuzu iptal etmek istediğinizi anlıyorum.\nReferans kodunuzu paylaşır mısınız? (Örn: RDV-2024-1847)',
    )
  }

  private async handleCancelStep(
    channel: MessagingChannel,
    msg: IncomingMessage,
    session: ConversationSession,
    salon: SalonContext,
  ): Promise<void> {
    const refCode = msg.text.trim().toUpperCase()
    const result = await cancelAppointmentByRef(session.tenantId, refCode)

    if (result.ok) {
      const reply = '✅ Randevunuz iptal edildi. Görüşmek üzere! 👋'
      this.sessionService.addMessage(session, 'assistant', reply)
      await channel.sendText(msg.from, reply)
      await this.sessionService.reset(session)
      return
    }

    if (result.reason === 'too_soon') {
      const contact = salon.phone ?? salon.address
      const reply = `Maalesef randevunuza 2 saatten az kaldığı için iptal yapamıyoruz. Salonumuzu arayabilirsiniz: ${contact}`
      this.sessionService.addMessage(session, 'assistant', reply)
      await channel.sendText(msg.from, reply)
      await this.sessionService.reset(session)
      return
    }

    // not_found — retry takibi
    const attempts = (((session.entities as Record<string, unknown>)['_cancelAttempts'] as number) ?? 0) + 1
    ;(session.entities as Record<string, unknown>)['_cancelAttempts'] = attempts

    if (attempts >= 2) {
      session.step = 'handed_off'
      const reply = `Bu koda ait randevu bulunamadı. Sizi salon yetkilisiyle bağlantıya geçiriyorum.\n\nAdres: ${salon.address}`
      this.sessionService.addMessage(session, 'assistant', reply)
      await channel.sendText(msg.from, reply)
      return
    }

    await channel.sendText(
      msg.from,
      `"${refCode}" koduna ait randevu bulunamadı. Tekrar dener misiniz?`,
    )
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
