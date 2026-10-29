// İlk kurulum listesi (tasarim.md §8.1 `bugun`, boş durum). Adımlar bilinen verilerden türetilir; "Çalışma saatleri" ve
// "Online randevu bağlantısı" adımları ayrı panel özeti ucuyla gelir (A-özet), uç hazır olmadan yüzde uydurulmaz.
export type SetupStep = { id: 'salon' | 'services' | 'staff' | 'first-appointment'; label: string; done: boolean; href: string | null }

export function buildSetupSteps(input: { slug: string; serviceCount: number; staffCount: number; todayAppointmentCount: number }): SetupStep[] {
  const base = `/panel/${encodeURIComponent(input.slug)}`
  return [
    // Panele girebilen her salon kayıt/kurulumdan geçmiştir.
    { id: 'salon', label: 'Salon bilgileri', done: true, href: `${base}/ayarlar` },
    { id: 'services', label: 'Hizmetleri ekleyin', done: input.serviceCount > 0, href: `${base}/hizmetler` },
    { id: 'staff', label: 'Personel ekleyin', done: input.staffCount > 0, href: `${base}/personel` },
    // Randevu oluşturma katmanıdır (W13); adres değil eylem.
    { id: 'first-appointment', label: 'İlk randevuyu oluşturun', done: input.todayAppointmentCount > 0, href: null },
  ]
}

export function setupProgress(steps: readonly SetupStep[]): { done: number; total: number; percent: number } {
  const done = steps.filter((s) => s.done).length
  return { done, total: steps.length, percent: steps.length === 0 ? 0 : Math.round((done / steps.length) * 100) }
}

/** Liste yalnız randevu almayı engelleyen eksik varken gösterilir (hizmet ya da personel yok); "ilk randevu" tek başına liste açtırmaz. */
export function needsSetup(steps: readonly SetupStep[]): boolean {
  return steps.some((s) => (s.id === 'services' || s.id === 'staff') && !s.done)
}
