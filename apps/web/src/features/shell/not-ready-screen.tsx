'use client'

import Link from 'next/link'
import { Hammer } from 'lucide-react'
import { legacyPathFor } from '@/lib/v2/routes'
import { useMe } from '@/lib/v2/session'
import { buttonClassName } from '@/ui/button'

// Henüz yeni arayüze taşınmamış ekranlar (W6 K6): eski arayüzdeki karşılığına geçiş verilir.
// `?eski=1` proxy'ye "yeni panele geri yönlendirme" demez; yoksa bağlantı döngüye girerdi.
export function NotReadyScreen({ rest }: { rest: string[] }) {
  const me = useMe()
  const legacy = legacyPathFor(rest.map(encodeURIComponent))

  return (
    <div className="grid justify-items-start gap-2 px-1 py-10 lg:py-16">
      <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-surface-active text-text-secondary">
        <Hammer className="size-5" />
      </span>
      <h1 className="text-xl font-semibold">Bu ekran yeni arayüzde hazırlanıyor.</h1>
      <p className="max-w-[44ch] text-base text-text-secondary">
        {legacy ? 'Hazır olana kadar eski ekranda çalışmaya devam edebilirsiniz.' : 'Hazır olana kadar Bugün ekranından devam edebilirsiniz.'}
      </p>
      <div className="mt-2 flex flex-wrap gap-3">
        {legacy ? (
          // Eski arayüz ayrı bir kök düzendir; tam sayfa geçişi gerekir (next/link ile istemci geçişi olmaz).
          <a href={`/tenant/${encodeURIComponent(me.tenant.slug)}/${legacy}?eski=1`} className={buttonClassName()}>
            Eski ekranda açın
          </a>
        ) : null}
        <Link href={`/panel/${me.tenant.slug}/bugun`} className={buttonClassName({ variant: legacy ? 'secondary' : 'primary' })}>
          Bugün’e dön
        </Link>
      </div>
    </div>
  )
}
