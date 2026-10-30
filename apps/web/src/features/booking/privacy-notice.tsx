'use client'

import { Sheet } from '@/ui/sheet'
import { Button } from '@/ui/button'
import { Banner } from '@/ui/banner'
import type { PublicTenant } from './api'

// Online randevuda veri sorumlusu salondur; BeautyOS'un kendi /kvkk sayfası bu form için doğru metin değildir (hukuk-uyum, 2026-10-30).
// Salon kendi metnini girdiyse o gösterilir; girmediyse taslak şablon salon bilgileriyle doldurulur. Boş alan gizlenmez, işaretlenir.
// Taslak avukat görüşü değildir: etiket her zaman görünür, canlı müşterilere açılmadan önce kurucu onayı gerekir.
const MISSING = '[Salon henüz girmedi]'
const filled = (value: string | null | undefined) => (value && value.trim() ? value.trim() : MISSING)

export function PrivacyNoticeSheet({ open, onOpenChange, tenant }: { open: boolean; onOpenChange: (open: boolean) => void; tenant: PublicTenant }) {
  const own = tenant.privacyText?.trim()
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Aydınlatma metni"
      description={`${tenant.name} randevu formu için kişisel verilerin işlenmesi bilgilendirmesi`}
      footer={<Button onClick={() => onOpenChange(false)}>Kapat</Button>}
    >
      {own ? <p className="whitespace-pre-line text-base leading-6">{own}</p> : <DraftNotice tenant={tenant} />}
    </Sheet>
  )
}

function DraftNotice({ tenant }: { tenant: PublicTenant }) {
  return (
    <div className="grid gap-3 text-base leading-6">
      <Banner tone="warning">Taslak metin. Salon kendi aydınlatma metnini girdiğinde burada o görünür.</Banner>
      <p>
        <strong>Veri sorumlusu:</strong> {tenant.name}, {filled(tenant.address)}, {filled(tenant.email)}, {filled(tenant.phone)}.
      </p>
      <div>
        <strong>Hangi verileriniz işlenir:</strong>
        <ul className="mt-1 list-disc pl-5">
          <li>Adınız ve telefon numaranız.</li>
          <li>Seçtiğiniz hizmet, uzman, tarih ve saat.</li>
          <li>Formun kötüye kullanılmasını önlemek için IP adresiniz ve tarayıcı bilgileriniz.</li>
        </ul>
      </div>
      <p>
        <strong>Amaç:</strong> Randevu talebinizi almak, değerlendirmek ve size bildirmek. Size randevu hatırlatması göndermek. Formun kötüye kullanılmasını önlemek.
      </p>
      <div>
        <strong>Hukuki sebep:</strong>
        <ul className="mt-1 list-disc pl-5">
          <li>Bir sözleşmenin kurulması ya da ifası için gerekli olması (KVKK m.5/2-c).</li>
          <li>Güvenlik için veri sorumlusunun meşru menfaati (m.5/2-f).</li>
        </ul>
      </div>
      <p>
        <strong>Toplama yöntemi:</strong> Bu online form üzerinden, elektronik ortamda.
      </p>
      <div>
        <strong>Kimlere aktarılır:</strong>
        <ul className="mt-1 list-disc pl-5">
          <li>Randevu sistemini sağlayan BeautyOS. Salon adına, veri işleyen olarak; sunucular Almanya’da.</li>
          <li>Hatırlatma iletileri için SMS ve e-posta gönderim hizmetleri.</li>
          <li>Formun güvenliği için Cloudflare. Bu hizmet sırasında IP adresiniz ve tarayıcı bilgileriniz yurt dışındaki (ABD) sunucularda işlenebilir.</li>
          <li>Hizmet sağlayıcıların listesi için salona başvurabilirsiniz.</li>
        </ul>
      </div>
      <div>
        <strong>Saklama:</strong>
        <ul className="mt-1 list-disc pl-5">
          <li>Talebiniz onaylanırsa bilgileriniz {tenant.name} müşteri kaydında tutulur.</li>
          <li>Talebiniz reddedilir ya da süresi dolarsa adınız ve telefon numaranız 30 gün içinde silinir.</li>
        </ul>
      </div>
      <p>
        <strong>Haklarınız (KVKK m.11):</strong> Verilerinizin işlenip işlenmediğini öğrenme, bilgi isteme, düzeltilmesini ya da silinmesini isteme, itiraz etme ve zararınızın giderilmesini talep etme haklarınız vardır. Başvurularınızı {filled(tenant.email)} adresine ya da yukarıdaki adrese yapabilirsiniz.
      </p>
      <p className="text-sm text-text-muted">Metin sürümü: v0-taslak</p>
    </div>
  )
}
