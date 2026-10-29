// Mock SMS provider — Netgsm credentials yokken kullanılır.
// Console'a yazar, gerçek SMS gönderilmez.

import type { SmsProvider, SmsSendInput, SmsSendResult } from './types'
import { smsPartCount } from './types'
import { logger } from '../logger'

export class MockSmsProvider implements SmsProvider {
  readonly name = 'mock'

  async send(input: SmsSendInput): Promise<SmsSendResult> {
    logger.info(
      // Gövde ve alıcı yazılmaz: OTP kodu, ad ve telefon içerir (KVKK). Yalnız boyut bilgisi.
      { partCount: smsPartCount(input.body), bodyLength: input.body.length },
      '📱 [MOCK SMS] (gerçek gönderim yok, env\'de NETGSM_USERCODE eksik)',
    )

    return {
      success: true,
      providerName: this.name,
      providerMessageId: `mock-${Date.now()}`,
      cost: 0,
    }
  }
}
