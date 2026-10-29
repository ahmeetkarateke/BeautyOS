// Terim setleri (ADR-UI-10, metin-rehberi §2b). Her terim beş hâl biçimi taşır; ek (ünlü uyumu) KOD İLE ÜRETİLMEZ, tabloda yazılıdır.
// Yasaklı sözcükler (hukuk-uyum §10): "tedavi", "hasta dosyası" vb. hiçbir sette yer almaz; hasta setinde hizmet "işlem"dir.

export const TERM_SETS = ['salon', 'clinic_client', 'clinic_patient'] as const
export type TermSet = (typeof TERM_SETS)[number]

export const TERM_FORMS = ['nom', 'plural', 'acc', 'dat', 'gen'] as const
export type TermForm = (typeof TERM_FORMS)[number]

export const TERM_KEYS = ['business', 'owner', 'client', 'expert', 'service', 'clientsMine'] as const
export type TermKey = (typeof TERM_KEYS)[number]

type Forms = Record<TermForm, string>

const form = (nom: string, plural: string, acc: string, dat: string, gen: string): Forms => ({ nom, plural, acc, dat, gen })

// "clientsMine": uzmanın kendi listesi ("Müşterilerim"); yalın hâl dışında biçimi yoktur, aynı değerle doldurulur.
const mine = (word: string): Forms => form(word, word, word, word, word)

export const DEFAULT_TERMS: Record<TermSet, Record<TermKey, Forms>> = {
  salon: {
    business: form('salon', 'salonlar', 'salonu', 'salona', 'salonun'),
    owner: form('salon sahibi', 'salon sahipleri', 'salon sahibini', 'salon sahibine', 'salon sahibinin'),
    client: form('müşteri', 'müşteriler', 'müşteriyi', 'müşteriye', 'müşterinin'),
    expert: form('uzman', 'uzmanlar', 'uzmanı', 'uzmana', 'uzmanın'),
    service: form('hizmet', 'hizmetler', 'hizmeti', 'hizmete', 'hizmetin'),
    clientsMine: mine('müşterilerim'),
  },
  clinic_client: {
    business: form('klinik', 'klinikler', 'kliniği', 'kliniğe', 'kliniğin'),
    owner: form('klinik sahibi', 'klinik sahipleri', 'klinik sahibini', 'klinik sahibine', 'klinik sahibinin'),
    client: form('danışan', 'danışanlar', 'danışanı', 'danışana', 'danışanın'),
    expert: form('uzman', 'uzmanlar', 'uzmanı', 'uzmana', 'uzmanın'),
    service: form('uygulama', 'uygulamalar', 'uygulamayı', 'uygulamaya', 'uygulamanın'),
    clientsMine: mine('danışanlarım'),
  },
  clinic_patient: {
    business: form('klinik', 'klinikler', 'kliniği', 'kliniğe', 'kliniğin'),
    owner: form('klinik sahibi', 'klinik sahipleri', 'klinik sahibini', 'klinik sahibine', 'klinik sahibinin'),
    client: form('hasta', 'hastalar', 'hastayı', 'hastaya', 'hastanın'),
    expert: form('hekim', 'hekimler', 'hekimi', 'hekime', 'hekimin'),
    service: form('işlem', 'işlemler', 'işlemi', 'işleme', 'işlemin'),
    clientsMine: mine('hastalarım'),
  },
}

/**
 * Terimi çözer: sahibin özel terimi (`terms`: "client" yalın, "client.acc" gibi biçim anahtarları) setin varsayılanını ezer.
 * Girilmeyen biçim setin varsayılanından gelir (ayarlar ekranı eki önerir, sahip düzeltir).
 */
export function resolveTerm(termSet: TermSet, overrides: Record<string, string>, key: TermKey, termForm: TermForm = 'nom'): string {
  const own = Object.hasOwn(overrides, `${key}.${termForm}`)
    ? overrides[`${key}.${termForm}`]
    : termForm === 'nom' && Object.hasOwn(overrides, key)
      ? overrides[key]
      : undefined
  return own ?? DEFAULT_TERMS[termSet][key][termForm]
}

/** Gösterim için cümle başı büyük harf (tr-TR: i -> İ). Karşılaştırma için kullanılmaz. */
export function capitalizeTr(text: string): string {
  return text.charAt(0).toLocaleUpperCase('tr-TR') + text.slice(1)
}
