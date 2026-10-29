// Ayarlar saf mantığı (W27). Bölüm görünürlüğü rolden gelir; asıl yetki sunucudadır (PATCH /settings sahip ve müdür).
export type SalonValues = { name: string; phone: string; address: string }
export type OnlineValues = { enabled: boolean; approval: 'auto' | 'manual'; whatsapp: string; about: string }

export type Section = { key: string; label: string; description: string; ownerOnly: boolean }

const SECTIONS: readonly Section[] = [
  { key: 'salon', label: 'Salon bilgileri', description: 'Ad, telefon ve adres.', ownerOnly: false },
  { key: 'online-randevu', label: 'Online randevu sayfası', description: 'Sayfayı aç/kapat ve randevuların onay şekli.', ownerOnly: false },
  { key: 'calisma-saatleri', label: 'Çalışma saatleri', description: 'Salonun haftalık çalışma saatleri.', ownerOnly: false },
  { key: 'moduller', label: 'Modüller', description: 'Hangi bölümlerin menüde görüneceği.', ownerOnly: true },
  { key: 'terimler', label: 'Terimler', description: 'Müşteri, hizmet gibi sözcüklerin adları.', ownerOnly: true },
]

/** Yalnız sahip ve müdür ayar görür; Modüller ve Terimler yalnız sahipte. */
export function sectionsFor(role: string): Section[] {
  if (role !== 'owner' && role !== 'manager') return []
  return SECTIONS.filter((section) => role === 'owner' || !section.ownerOnly)
}

export function validateSalon(values: SalonValues): Record<string, string> {
  const errors: Record<string, string> = {}
  const name = values.name.trim()
  if (name.length < 2 || name.length > 100) errors.name = 'Salon adı 2 ile 100 karakter arasında olmalı.'
  const phone = values.phone.trim()
  if (phone.length < 7 || phone.length > 20) errors.phone = 'Telefonu 7 ile 20 karakter arasında yazın.'
  const address = values.address.trim()
  if (address.length < 5 || address.length > 255) errors.address = 'Adresi en az 5 karakterle yazın.'
  return errors
}

export function salonPatch(values: SalonValues, original: SalonValues): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  for (const key of ['name', 'phone', 'address'] as const) {
    if (values[key].trim() !== original[key].trim()) patch[key] = values[key].trim()
  }
  return patch
}

export function validateOnline(values: OnlineValues): Record<string, string> {
  const errors: Record<string, string> = {}
  const whatsapp = values.whatsapp.trim()
  if (whatsapp !== '' && (whatsapp.length < 7 || whatsapp.length > 20))
    errors.whatsapp = 'WhatsApp numarasını 7 ile 20 karakter arasında yazın ya da boş bırakın.'
  if (values.about.length > 500) errors.about = 'Hakkında metni en çok 500 karakter olabilir.'
  return errors
}

export function onlinePatch(values: OnlineValues, original: OnlineValues): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  if (values.enabled !== original.enabled) patch.publicBookingEnabled = values.enabled
  if (values.approval !== original.approval) patch.onlineBookingApproval = values.approval
  if (values.whatsapp.trim() !== original.whatsapp.trim()) patch.whatsappNumber = values.whatsapp.trim()
  if (values.about.trim() !== original.about.trim()) patch.aboutText = values.about.trim()
  return patch
}

// Sunucu modül anahtarları (apps/api/src/lib/modules.ts ile aynı). Ayarlar ve Bugün kapatılamaz: kilitlenme olmasın.
export const MODULES: { key: string; label: string; locked: boolean }[] = [
  { key: 'dashboard', label: 'Bugün', locked: true },
  { key: 'appointments', label: 'Takvim ve randevular', locked: false },
  { key: 'customers', label: 'Müşteriler', locked: false },
  { key: 'services', label: 'Hizmetler', locked: false },
  { key: 'staff', label: 'Personel', locked: false },
  { key: 'packages', label: 'Paketler', locked: false },
  { key: 'tips', label: 'Bahşiş', locked: false },
  { key: 'staff-payouts', label: 'Personel ödemeleri', locked: false },
  { key: 'finance', label: 'Kasa', locked: false },
  { key: 'current-accounts', label: 'Cari hesap', locked: false },
  { key: 'purchase-invoices', label: 'Alış faturaları', locked: false },
  { key: 'suppliers', label: 'Tedarikçiler', locked: false },
  { key: 'accounts', label: 'Hesaplar', locked: false },
  { key: 'inventory', label: 'Stok', locked: false },
  { key: 'waitlist', label: 'Bekleme listesi', locked: false },
  { key: 'customer-anamnesis', label: 'Müşteri formu', locked: false },
  { key: 'customer-photos', label: 'Müşteri fotoğrafları', locked: false },
  { key: 'settings', label: 'Ayarlar', locked: true },
]

export function moduleToggle(active: readonly string[], key: string, on: boolean): string[] {
  const locked = MODULES.find((m) => m.key === key)?.locked ?? false
  if (on) return active.includes(key) ? [...active] : [...active, key]
  return locked ? [...active] : active.filter((k) => k !== key)
}
