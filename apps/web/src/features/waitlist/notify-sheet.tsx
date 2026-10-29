'use client'

import { useState } from 'react'
import { whatsappHref } from '@/features/appointment-detail/actions'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useMe } from '@/lib/v2/session'
import { Banner } from '@/ui/banner'
import { Button, buttonClassName } from '@/ui/button'
import { Sheet } from '@/ui/sheet'
import { useToast } from '@/ui/toast'
import { markNotified } from './api'
import { isHealthRegulated } from '@/lib/v2/business-type'
import { notifyMessage, type WaitEntry } from './logic'

// Müşteriye haber ver: mesaj önizlenir, salon çalışanı WhatsApp ile kendisi gönderir, sonra "Haber verildi" işaretlenir.
// BeautyOS bu mesajı kendisi göndermez (SMS sağlayıcısı henüz yok); uyarı bunu açıkça söyler.
export function NotifySheet({ entry, onClose, onDone }: { entry: WaitEntry; onClose: () => void; onDone: () => void }) {
  const client = useApiClient()
  const me = useMe()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const message = notifyMessage(entry, me.tenant.name, isHealthRegulated(me.tenant.businessType))
  const wa = entry.customerPhone ? whatsappHref(entry.customerPhone) : null

  async function mark() {
    if (busy) return
    setBusy(true)
    setFailure(null)
    try {
      await markNotified(client, me.tenant.slug, entry.id)
      toast.show({ message: 'Haber verildi olarak işaretlendi.' })
      onDone()
    } catch (err) {
      setFailure((err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK' })).text())
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      title="Müşteriye haber ver"
      description={entry.customerName}
      footer={
        <Button disabled={busy} loading={busy} loadingText="Kaydediliyor…" onClick={() => void mark()}>
          Haber verildi olarak işaretle
        </Button>
      }
    >
      <div className="grid gap-4 pb-2">
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        <Banner tone="info">BeautyOS bu mesajı kendisi göndermez. Mesajı WhatsApp ya da telefonla siz iletin, sonra aşağıdan işaretleyin.</Banner>
        <div className="grid gap-1.5">
          <span className="text-sm font-medium">Mesaj önizlemesi</span>
          <p data-testid="mesaj-onizleme" className="m-0 rounded-card border border-border bg-surface-subtle p-3 text-base">
            {message}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {wa ? (
            <a
              href={`${wa}?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClassName({ variant: 'secondary' })}
            >
              WhatsApp’ta aç
            </a>
          ) : (
            <p className="text-sm text-text-muted">Telefon kaydı yok; müşteriye başka yoldan ulaşın.</p>
          )}
          {entry.customerPhone ? (
            <a href={`tel:${entry.customerPhone.replace(/\s/g, '')}`} className={buttonClassName({ variant: 'secondary' })}>
              Ara
            </a>
          ) : null}
        </div>
      </div>
    </Sheet>
  )
}
