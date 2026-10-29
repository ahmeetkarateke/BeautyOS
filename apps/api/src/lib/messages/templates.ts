// ADR-0047: ileti şablonları kodda sürümlü ve değişmezdir. message_deliveries gövde yerine (anahtar, sürüm) saklar;
// gönderilen metin şablon + randevu/salon bilgisiyle yeniden üretilir. Yayınlanmış bir sürümün metni DEĞİŞTİRİLMEZ:
// değişiklik yeni sürümdür (templates.test.ts her sürümün sha-256 özetini sabit listeyle karşılaştırır).
export interface TemplateRef {
  key: string
  version: number
}

type Params = Record<string, string>

// Yer tutucular {ad} biçimindedir. Metinler sürüm kilidi altındadır.
const SOURCES: Record<string, string> = {
  'reminder_24h@1': "{salon}: Sayın {name}, yarın saat {time}'de {service} randevunuz bulunmaktadır. Bilginize.",
  'reminder_24h_health@1': "{salon}: Sayın {name}, yarın saat {time}'de randevunuz bulunmaktadır. Bilginize.",
  'reminder_2h@1': "{salon}: Sayın {name}, bugün saat {time}'de {service} randevunuz vardır. Sizi bekliyoruz.",
  'reminder_2h_health@1': "{salon}: Sayın {name}, bugün saat {time}'de randevunuz vardır. Sizi bekliyoruz.",
  'phone_verification@1': 'BeautyOS doğrulama kodunuz: {code}\nKod 10 dakika geçerlidir. Güvenliğiniz için kimseyle paylaşmayın.',
}

export const TEMPLATE_IDS: readonly string[] = Object.keys(SOURCES)

export function templateSource(ref: TemplateRef): string {
  const source = SOURCES[`${ref.key}@${ref.version}`]
  if (source === undefined) throw new Error(`Bilinmeyen ileti şablonu: ${ref.key}@${ref.version}`)
  return source
}

/** Şablonu parametrelerle doldurur. Eksik parametre hata verir (boş yer tutucu ile ileti gitmesin). */
export function renderTemplate(ref: TemplateRef, params: Params): string {
  return templateSource(ref).replace(/\{(\w+)\}/g, (_m, name: string) => {
    const value = params[name]
    if (value === undefined) throw new Error(`Şablon parametresi eksik: ${name}`)
    return value
  })
}

/** Veri geçişinde şablonu belirlenemeyen eski kayıtların işareti. */
export const LEGACY_TEMPLATE: TemplateRef = { key: 'legacy', version: 0 }
