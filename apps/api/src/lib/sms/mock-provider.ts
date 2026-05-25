// Mock SMS provider — Netgsm credentials yokken kullanılır.
// Console'a yazar, gerçek SMS gönderilmez.

import type { SmsProvider, SmsSendInput, SmsSendResult } from './types'
import { smsPartCount } from './types'
import { logger } from '../logger'

export class MockSmsProvider implements SmsProvider {
  readonly name = 'mock'

  async send(input: SmsSendInput): Promise<SmsSendResult> {
    logger.info(
      {
        to: input.to,
        body: input.body,
        partCount: smsPartCount(input.body),
      },
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
