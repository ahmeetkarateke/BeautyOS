// Netgsm SMS provider — REST API ile gönderim.
// Docs: https://www.netgsm.com.tr/dokuman/

import type { SmsProvider, SmsSendInput, SmsSendResult } from './types'
import { smsPartCount } from './types'
import { logger } from '../logger'

interface NetgsmConfig {
  usercode: string  // Netgsm panel kullanıcı kodu
  password: string  // Netgsm API şifresi
  header: string    // Onaylı sender ID (örn. "BEAUTYOS")
  costPerPart?: number  // SMS parça başına maliyet (TL), default 0.06
}

export class NetgsmProvider implements SmsProvider {
  readonly name = 'netgsm'
  private cfg: NetgsmConfig

  constructor(cfg: NetgsmConfig) {
    this.cfg = cfg
  }

  async send(input: SmsSendInput): Promise<SmsSendResult> {
    // Netgsm telefonu 90XXXXXXXXXX (12 haneli, + ve boşluksuz) formatında ister
    const to = input.to.replace(/[^\d]/g, '')

    const params = new URLSearchParams({
      usercode: this.cfg.usercode,
      password: this.cfg.password,
      msgheader: input.header ?? this.cfg.header,
      gsmno: to,
      message: input.body,
      filter: '0',  // 0 = TR karakter destekli (UCS-2)
    })

    try {
      const res = await fetch('https://api.netgsm.com.tr/sms/send/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      })

      const text = await res.text()
      // Netgsm response format: "00 <bulkId>" başarılı; "20", "30", "40" vs. hata
      const [code, ...rest] = text.trim().split(/\s+/)

      const cost = (this.cfg.costPerPart ?? 0.06) * smsPartCount(input.body)

      if (code === '00' || code === '01' || code === '02') {
        return {
          success: true,
          providerName: this.name,
          providerMessageId: rest.join(' ') || undefined,
          cost,
        }
      }

      return {
        success: false,
        providerName: this.name,
        errorCode: code,
        errorMessage: netgsmErrorMessage(code),
      }
    } catch (err) {
      logger.error({ err }, 'Netgsm SMS gönderim hatası')
      return {
        success: false,
        providerName: this.name,
        errorCode: 'NETWORK_ERROR',
        errorMessage: (err as Error).message,
      }
    }
  }
}

function netgsmErrorMessage(code: string): string {
  const map: Record<string, string> = {
    '20': 'Mesaj metni problemli',
    '30': 'Geçersiz kullanıcı adı, şifre veya API erişim izni yok',
    '40': 'Mesaj başlığı (header) onaylı değil',
    '50': 'Abone hesabı IYS sistemiyle eşleşmedi',
    '51': 'Abone IYS sisteminden onay vermedi',
    '70': 'Geçersiz parametre',
    '85': 'Mükerrer gönderim limiti aşıldı',
    '99': 'Genel hata',
  }
  return map[code] ?? `Bilinmeyen hata kodu: ${code}`
}
