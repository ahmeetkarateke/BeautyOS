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

// ─── 3 Katman Hata Yönetimi Eşikleri ─────────────────────────────────────────
const CLARIFY_LIMIT = 2    // Bu kadar netleştirme turdan sonra → basit mod
const HANDOFF_LIMIT = 4    // Bu kadar başarısız turdan sonra → insana yönlendir

// ─── Yanıt metinleri (ileride i18n dosyasına taşınabilir) ────────────────────
const REPLIES = {
  welcome: (name: string, services: SalonContext['services']) => {
    const top3 = services.slice(0, 3).map((s) => s.name).join(', ')
    return `Merhaba! 👋 Ben *${name}* salonunun asistanıyım. Size nasıl yardımcı olabilirim?\n\nRandevu almak için hizmet adı yazabilirsiniz.\nHizmetlerimiz: ${top3}`
  },

  askService: '📋 Hangi hizmet için randevu almak istersiniz?',

  askDate: (service: string) =>
    `*${service}* için ne zaman gelmek istersiniz? (Örn: "yarın", "Cumartesi öğleden sonra")`,

  askTime: (date: string) => `*${date}* için hangi saate gelmeniz uygun?`,

  slotOptions: '🗓️ Uygun saatler:',

  bookingConfirmed: (service: string, date: string, staff: string, ref: string) =>
    `✅ Randevunuz oluşturuldu!\n\n📋 *${service}*\n📅 ${date}\n👤 ${staff}\n🔖 Referans: \`${ref}\`\n\nSizi bekliyoruz! 🌸`,

  cancelAsk: '❓ İptal etmek istediğiniz randevunuzun referans kodunu yazar mısınız?',

  cancelConfirmed: '✅ Randevunuz iptal edildi. Görüşmek üzere! 👋',

  priceList: (services: SalonContext['services']) =>
    '💰 *Fiyat Listemiz:*\n\n' +
    services.map((s) => `• ${s.name}: ₺${s.price}'dan başlayan`).join('\n'),

  // Katman 1 — netleştirme sorusu
  clarify: (question: string) => question,

  // Katman 2 — yapılandırılmış yönlendirme
  simplify:
    '🤔 Tam anlayamadım. Şu şekilde yazabilirsiniz:\n\n"*[Hizmet adı] [gün]*"\n\nÖrnek: _"Manikür yarın"_ veya _"Saç kesimi Cumartesi"_',

  // Katman 3 — insana yönlendirme
  handoff:
    '🙏 Sizi salonumuzla bağlantı kurayım. Birkaç dakika içinde size dönecekler.\n\nAcil ihtiyaç için: 📞 {PHONE}',

  notUnderstood: 'Üzgünüm, bunu tam anlayamadım. Randevu almak için "randevu" yazabilirsiniz.',

  generalFallback: 'Bu konuda yardımcı olamıyorum. Başka bir isteğiniz var mı?',
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
    // Oturumu yükle (veya oluştur)
    const session = await this.sessionService.getOrCreate(
      tenantId,
      msg.channelType,
      msg.from,
    )

    this.sessionService.addMessage(session, 'user', msg.text)

    logger.info(
      { from: msg.from, step: session.step, turn: session.turnCount, text: msg.text },
      'Mesaj alındı',
    )

    try {
      await this.route(channel, msg, session, salon)
    } catch (error) {
      logger.error({ error, from: msg.from }, 'Flow handler hatası')
      await channel.sendText(msg.from, REPLIES.notUnderstood)
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
    // /start komutu veya ilk mesaj → karşılama + session sıfırla
    if (msg.text === '/start' || (session.turnCount === 1 && session.step === 'idle')) {
      await this.sessionService.reset(session)
      await channel.sendText(msg.from, REPLIES.welcome(salon.name, salon.services))
      return
    }

    // Handoff modunda → insan devredeyken bot sessiz kalır
    if (session.step === 'handed_off') {
      return
    }

    // Aktif bir niyet varsa → akışa devam et
    if (session.currentIntent === 'book' && session.step !== 'idle') {
      await this.handleBookingStep(channel, msg, session, salon)
      return
    }

    if (session.currentIntent === 'cancel' && session.step !== 'idle') {
      await this.handleCancelStep(channel, msg, session, salon)
      return
    }

    // Yeni niyet tespit et
    const result = await this.intentService.detect(session, msg.text, salon)

    // ── 3 Katman Hata Yönetimi ────────────────────────────────────────────

    // Katman 3: Çok fazla başarısız tur → insana yönlendir
    if (session.clarifyCount >= HANDOFF_LIMIT) {
      session.step = 'handed_off'
      const reply = REPLIES.handoff.replace('{PHONE}', salon.address)
      await channel.sendText(msg.from, reply)
      // TODO: işletme sahibine bildirim gönder
      return
    }

    // Katman 2: 2+ netleştirme başarısız → basit format iste
    if (session.clarifyCount >= CLARIFY_LIMIT && result.confidence < 0.5) {
      session.clarifyCount++
      await channel.sendText(msg.from, REPLIES.simplify)
      return
    }

    // Katman 1: Düşük güven → netleştirme sorusu sor
    if (this.intentService.isLowConfidence(result) && result.requiresClarification) {
      session.clarifyCount++
      const question =
        result.clarificationQuestion ?? 'Ne yapmak istediğinizi biraz daha açar mısınız?'
      await channel.sendText(msg.from, REPLIES.clarify(question))
      return
    }

    // unknown intent → clarifyCount artır, döngüye girme
    if (result.intent === 'unknown') {
      session.clarifyCount++
      if (session.clarifyCount >= HANDOFF_LIMIT) {
        session.step = 'handed_off'
        const reply = REPLIES.handoff.replace('{PHONE}', salon.address)
        await channel.sendText(msg.from, reply)
        return
      }
      if (session.clarifyCount >= CLARIFY_LIMIT) {
        await channel.sendText(msg.from, REPLIES.simplify)
      } else {
        await channel.sendText(
          msg.from,
          '🤔 Tam anlayamadım — randevu almak, fiyat öğrenmek veya iptal için yazabilirsiniz.',
        )
      }
      return
    }

    // Niyet net → sıfırla ve yönlendir
    session.clarifyCount = 0
    session.currentIntent = result.intent
    Object.assign(session.entities, result.entities)

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
        await this.handleAvailabilityQuery(channel, msg, session, salon)
        break
      case 'general':
        await this.handleGeneral(channel, msg, session, salon)
        break
      default:
        await channel.sendText(msg.from, REPLIES.notUnderstood)
    }
  }

  // ─── Randevu Akışı ────────────────────────────────────────────────────────

  private async startBooking(
    channel: MessagingChannel,
    msg: IncomingMessage,
    session: ConversationSession,
    salon: SalonContext,
  ): Promise<void> {
    session.step = 'awaiting_service'

    if (session.entities.service) {
      // Hizmet zaten çıkarıldı, tarihe geç
      await this.askForDate(channel, msg, session)
      return
    }

    // Hizmet listesi göster
    await channel.sendList(msg.from, REPLIES.askService, [
      {
        title: 'Hizmetlerimiz',
        items: salon.services.map((s) => ({
          id: `service:${s.name}`,
          label: s.name,
          description: `${s.duration} dk • ₺${s.price}'dan başlayan`,
        })),
      },
    ])
  }

  private async handleBookingStep(
    channel: MessagingChannel,
    msg: IncomingMessage,
    session: ConversationSession,
    salon: SalonContext,
  ): Promise<void> {
    switch (session.step) {
      case 'awaiting_service': {
        // Buton seçimi veya serbest metin
        const serviceId = msg.text.startsWith('service:')
          ? msg.text.replace('service:', '')
          : msg.text

        const matched = salon.services.find(
          (s) => s.name.toLowerCase().includes(serviceId.toLowerCase()),
        )

        if (!matched) {
          await channel.sendText(msg.from, '❓ Bu hizmeti bulamadım. Listeden seçer misiniz?')
          return
        }

        session.entities.service = matched.name
        await this.askForDate(channel, msg, session)
        break
      }

      case 'awaiting_date': {
        session.entities.datePreference = msg.text
        await this.askForTime(channel, msg, session)
        break
      }

      case 'awaiting_time': {
        session.entities.timePreference = msg.text
        await this.showSlots(channel, msg, session)
        break
      }

      case 'awaiting_slot_confirm': {
        if (msg.text.startsWith('slot:')) {
          await this.confirmBooking(channel, msg, session)
        } else {
          await channel.sendText(msg.from, '❓ Lütfen listeden bir saat seçin.')
        }
        break
      }
    }
  }

  private async askForDate(
    channel: MessagingChannel,
    msg: IncomingMessage,
    session: ConversationSession,
  ): Promise<void> {
    session.step = 'awaiting_date'
    await channel.sendButtons(msg.from, REPLIES.askDate(session.entities.service!), [
      { id: 'date:bugun', label: '📅 Bugün' },
      { id: 'date:yarin', label: '📅 Yarın' },
      { id: 'date:bu_hafta', label: '📅 Bu hafta' },
    ])
  }

  private async askForTime(
    channel: MessagingChannel,
    msg: IncomingMessage,
    session: ConversationSession,
  ): Promise<void> {
    session.step = 'awaiting_time'

    const dateLabel = session.entities.datePreference?.replace('date:', '') ?? 'seçilen gün'
    await channel.sendButtons(msg.from, REPLIES.askTime(dateLabel), [
      { id: 'time:sabah', label: '🌅 Sabah (09-12)' },
      { id: 'time:oglen', label: '☀️ Öğlen (12-15)' },
      { id: 'time:aksam', label: '🌆 Akşam (15-19)' },
    ])
  }

  private async showSlots(
    channel: MessagingChannel,
    msg: IncomingMessage,
    session: ConversationSession,
  ): Promise<void> {
    session.step = 'awaiting_slot_confirm'

    const slots = await getAvailableSlots(
      session.tenantId,
      session.entities.service ?? '',
      session.entities.datePreference,
      session.entities.timePreference,
    )

    // Slot ID'lerini session'da sakla (confirmBooking'de kullanmak için)
    session.entities = { ...session.entities, _slots: slots as unknown as string } as typeof session.entities

    const dateLabel = session.entities.datePreference?.replace('date:', '') ?? 'Uygun saatler'

    await channel.sendList(msg.from, REPLIES.slotOptions, [
      {
        title: dateLabel,
        items: slots.map((s: AvailableSlot) => ({
          id: `slot:${s.id}`,
          label: `🕐 ${s.label}`,
          description: `${session.entities.service} — ${s.staffName}`,
        })),
      },
    ])
  }

  private async confirmBooking(
    channel: MessagingChannel,
    msg: IncomingMessage,
    session: ConversationSession,
  ): Promise<void> {
    const slotId = msg.text.replace('slot:', '')
    const service = session.entities.service ?? ''
    const channel_type = session.channelType === 'telegram' ? 'telegram' : 'whatsapp'

    let ref: string
    let staffName = 'Uygun Uzman'

    try {
      // slotId: "YYYY-MM-DDTHH:MM:SS__staffId" ya da "mock-staff" içeriyorsa mock
      if (slotId.includes('mock-staff')) {
        ref = `RDV-${Date.now().toString(36).toUpperCase()}`
      } else {
        ref = await createAppointment({
          tenantId: session.tenantId,
          customerPhone: session.from,
          customerName: session.from, // WhatsApp numarasından isim bilinmiyor
          serviceName: service,
          slotId,
          channel: channel_type as 'telegram' | 'whatsapp',
        })

        // Slot listesinden staff adını bul
        const storedSlots = (session.entities as Record<string, unknown>)['_slots'] as AvailableSlot[] | undefined
        const matched = storedSlots?.find((s: AvailableSlot) => s.id === slotId)
        if (matched) staffName = matched.staffName
      }
    } catch (error) {
      logger.error({ error, slotId }, 'Randevu kaydetme hatası')
      await channel.sendText(msg.from, '❌ Randevu oluşturulurken bir sorun oluştu. Lütfen tekrar deneyin.')
      return
    }

    // Tarih/saat etiketini oluştur
    const dateStr = slotId.split('T')[0] ?? ''
    const timeStr = slotId.split('T')[1]?.slice(0, 5) ?? ''

    const reply = REPLIES.bookingConfirmed(service, `${dateStr} ${timeStr}`, staffName, ref)
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
    await channel.sendText(msg.from, REPLIES.cancelAsk)
  }

  private async handleCancelStep(
    channel: MessagingChannel,
    msg: IncomingMessage,
    session: ConversationSession,
    _salon: SalonContext,
  ): Promise<void> {
    const refCode = msg.text.trim().toUpperCase()
    const cancelled = await cancelAppointmentByRef(session.tenantId, refCode)

    const reply = cancelled
      ? REPLIES.cancelConfirmed
      : `❓ "${refCode}" referans kodlu aktif randevu bulunamadı. Lütfen kontrol edip tekrar deneyin.`

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
    await channel.sendText(msg.from, REPLIES.priceList(salon.services))
  }

  // ─── Müsaitlik Sorgusu ────────────────────────────────────────────────────

  private async handleAvailabilityQuery(
    channel: MessagingChannel,
    msg: IncomingMessage,
    session: ConversationSession,
    salon: SalonContext,
  ): Promise<void> {
    const reply = await this.intentService.generateReply(
      session,
      msg.text,
      salon,
      'Kullanıcının müsaitlik sorusunu yanıtla, randevu almak istiyorsa yönlendir',
    )
    this.sessionService.addMessage(session, 'assistant', reply)
    await channel.sendText(msg.from, reply)
  }

  // ─── Genel Soru ───────────────────────────────────────────────────────────

  private async handleGeneral(
    channel: MessagingChannel,
    msg: IncomingMessage,
    session: ConversationSession,
    salon: SalonContext,
  ): Promise<void> {
    const reply = await this.intentService.generateReply(
      session,
      msg.text,
      salon,
      'Kullanıcının genel sorusunu yanıtla, bilmiyorsan salona yönlendir',
    )
    this.sessionService.addMessage(session, 'assistant', reply)
    await channel.sendText(msg.from, reply)
    await this.sessionService.reset(session)
  }
}
