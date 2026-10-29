// SMS Service — sağlayıcı seçimi + delivery kaydı + maliyet
import { Prisma, type Customer, type MessageDelivery, DeliveryStatus, DeliveryPurpose, MessageChannel } from '@prisma/client'
import { db } from '../db'
import { logger } from '../logger'
import { NetgsmProvider } from './netgsm-provider'
import { MockSmsProvider } from './mock-provider'
import type { SmsProvider, SmsSendInput, SmsSendResult } from './types'
import type { TemplateRef } from '../messages/templates'

export { normalizePhoneTR, smsPartCount } from './types'
export type { SmsProvider, SmsSendInput, SmsSendResult }

let cachedProvider: SmsProvider | null = null

export function getSmsProvider(): SmsProvider {
  if (cachedProvider) return cachedProvider

  const usercode = process.env.NETGSM_USERCODE
  const password = process.env.NETGSM_PASSWORD
  const header = process.env.NETGSM_HEADER ?? 'BEAUTYOS'

  if (usercode && password) {
    cachedProvider = new NetgsmProvider({
      usercode,
      password,
      header,
      costPerPart: process.env.SMS_COST_PER_PART ? Number(process.env.SMS_COST_PER_PART) : 0.06,
    })
    logger.info({ header }, 'SMS provider: Netgsm (production)')
  } else {
    cachedProvider = new MockSmsProvider()
    logger.warn('SMS provider: Mock (NETGSM_USERCODE eksik — gerçek SMS gönderilmiyor)')
  }

  return cachedProvider
}

export interface SendSmsParams {
  tenantId: string
  customerId?: string | null
  appointmentId?: string | null
  to: string
  /** Sağlayıcıya giden metin. Şablon verilmişse veritabanına YAZILMAZ (ADR-0047). */
  body: string
  /** Şablonlu iletide (hatırlatma, doğrulama, onay, iptal) gövde yerine bu (anahtar, sürüm) saklanır. */
  template?: TemplateRef
  purpose: DeliveryPurpose
}

/**
 * SMS gönderir + delivery record oluşturur.
 * Sağlayıcı çağrısı başarısız olursa delivery'i 'failed' olarak işaretler.
 * Throw etmez — caller başarıyı return değerinden kontrol eder.
 */
export async function sendSms(params: SendSmsParams): Promise<{ delivery: MessageDelivery; result: SmsSendResult }> {
  const provider = getSmsProvider()

  // Önce queued olarak kaydet
  const delivery = await db.messageDelivery.create({
    data: {
      tenantId: params.tenantId,
      customerId: params.customerId ?? null,
      appointmentId: params.appointmentId ?? null,
      channel: MessageChannel.sms,
      purpose: params.purpose,
      phone: params.to,
      body: params.template ? null : params.body,
      templateKey: params.template?.key ?? null,
      templateVersion: params.template?.version ?? null,
      status: DeliveryStatus.queued,
      providerName: provider.name,
    },
  })

  // Sağlayıcıya gönder
  const result = await provider.send({ to: params.to, body: params.body })

  // Sonucu kaydet
  const updated = await db.messageDelivery.update({
    where: { id: delivery.id },
    data: {
      status: result.success ? DeliveryStatus.sent : DeliveryStatus.failed,
      providerMessageId: result.providerMessageId,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      cost: result.cost !== undefined ? new Prisma.Decimal(result.cost) : null,
      sentAt: result.success ? new Date() : null,
    },
  })

  return { delivery: updated, result }
}
