'use client'

import { useState } from 'react'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useMe } from '@/lib/v2/session'
import { Banner } from '@/ui/banner'
import { Button } from '@/ui/button'
import { TextareaField } from '@/ui/field'
import { Sheet } from '@/ui/sheet'
import { useToast } from '@/ui/toast'
import { reopenDay } from './api'
import { reopenBody, reopenIssue } from './logic'

// Günü yeniden aç (R5): neden zorunlu, kayıt tutulur. Yalnız sahip ve müdür (finance.correction).
export function ReopenDaySheet({ date, onClose, onDone }: { date: string; onClose: () => void; onDone: () => void }) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [issue, setIssue] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  async function save() {
    if (busy) return
    const found = reopenIssue(reason)
    setIssue(found)
    if (found) return
    setBusy(true)
    setFailure(null)
    try {
      await reopenDay(client, slug, reopenBody(date, reason))
      toast.show({ message: 'Gün yeniden açıldı.' })
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
      title="Günü yeniden aç"
      description="Açılan güne yeniden ödeme yazılabilir. Kim, ne zaman ve neden açtığı kayıt altında tutulur."
      footer={
        <Button disabled={busy} loading={busy} loadingText="Açılıyor…" onClick={() => void save()}>
          Günü yeniden aç
        </Button>
      }
    >
      <div className="grid gap-4 pb-2">
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        <TextareaField
          label="Neden açılıyor?"
          maxLength={300}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value)
            setIssue(null)
          }}
          error={issue ?? undefined}
        />
      </div>
    </Sheet>
  )
}
