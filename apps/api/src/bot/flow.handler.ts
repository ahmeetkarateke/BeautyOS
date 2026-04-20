import { logger } from '../lib/logger'
import type { MessagingChannel, IncomingMessage } from '../channels/types'
import type { SessionService, ConversationSession } from '../session/session.service'
import type { IntentService, SalonContext } from '../ai/intent.service'

// ─── 3 Katman Hata Yönetimi Eşikleri ─────────────────────────────────────────
const CLARIFY_LIMIT = 2    // Bu kadar netleştirme turdan sonra → basit mod
const HANDOFF_LIMIT = 4    // Bu kadar başarısız turdan sonra → insana yönlendir

// ─── Yanıt metinleri (ileride i18n dosyasına taşınabilir) ────────────────────
const REPLIES = {
  welcome: (name: string) =>
    `Merhaba! 👋 Ben *${name}* salonunun asistanıyım. Size nasıl yardımcı olabilirim?`,

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
  ): Promise<void> {
    // Oturumu yükle (veya oluştur)
    const session = await this.sessionService.getOrCreate(
      // MVP'de tenant sabit — ileride phoneNumberId → tenantId çözümlemesi yapılacak
      'test-tenant',
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
      await channel.sendText(msg.from, REPLIES.welcome(salon.name))
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

    // TODO: Gerçek slot sorgulaması — şimdilik mock veriler
    const mockSlots = ['10:00', '13:00', '15:30']

    await channel.sendList(msg.from, REPLIES.slotOptions, [
      {
        title: `${session.entities.datePreference?.replace('date:', '') ?? 'Uygun saatler'}`,
        items: mockSlots.map((t) => ({
          id: `slot:${t}`,
          label: `🕐 ${t}`,
          description: session.entities.service,
        })),
      },
    ])
  }

  private async confirmBooking(
    channel: MessagingChannel,
    msg: IncomingMessage,
    session: ConversationSession,
  ): Promise<void> {
    const time = msg.text.replace('slot:', '')
    const date = session.entities.datePreference?.replace('date:', '') ?? ''
    const service = session.entities.service ?? ''

    // TODO: Veritabanına kaydet — şimdilik referans kodu simüle et
    const ref = `RDV-TEST-${Date.now().toString(36).toUpperCase()}`

    const reply = REPLIES.bookingConfirmed(service, `${date} ${time}`, 'Uygun uzman', ref)
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
    // TODO: Referans kodu ile veritabanında randevu bul ve iptal et
    const reply = REPLIES.cancelConfirmed
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
