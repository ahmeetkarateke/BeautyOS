'use client'

import { useRef, useState } from 'react'
import { rescheduleAppointment } from '@/features/appointment-detail/api'
import { clockLabel, type DayAppointment } from '@/features/appointments/day-logic'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useMe } from '@/lib/v2/session'
import { useToast } from '@/ui/toast'
import type { DropTarget } from './drag-logic'
import { moveToast } from './drag-logic'

// Sürükle-bırak sonrası taşıma akışı (W15). Sunucu karar verir: saat doluysa (SLOT_TAKEN) randevu yerine döner ve hata şeridi çıkar.
// Başarıda 8 sn "Geri al" sunulur; geri alma, eski başlangıç saatine yeni bir saat değiştirme isteğidir ve o da dolmuş olabilir.
export const UNDO_FAILED_TAKEN = 'Eski saat doldu, taşıma geri alınamadı. Randevuyu açıp “Saati değiştir” ile başka bir saat seçin.'
export const MOVE_IN_PROGRESS = 'Önceki taşıma sürüyor. Bitince yeniden deneyin.'

/** Taşınan randevunun gösterileceği yer. Başarıdan sonra liste yenilenene dek (done) korunur: eski yere göz kırpma olmaz. */
export type PendingMove = {
  id: string
  startAt: Date
  endAt: Date
  doneAt?: number
}

function asApiError(err: unknown): ApiError {
  return err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK' })
}

export function useAppointmentMove({ onChanged, loadedAt }: { onChanged: () => void; loadedAt: Date | undefined }) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const toast = useToast()
  const [moved, setMoved] = useState<PendingMove | null>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)
  const [inFlight, setInFlight] = useState(false)

  // Türetilmiş: yenileme gelince (loadedAt >= doneAt) geçersiz olur; efekt yok.
  const pending = moved && !(moved.doneAt !== undefined && loadedAt && loadedAt.getTime() >= moved.doneAt) ? moved : null

  async function send(a: DayAppointment, startAt: Date, endAt: Date): Promise<ApiError | null> {
    busy.current = true
    setInFlight(true)
    setMoved({ id: a.id, startAt, endAt })
    let failure: ApiError | null = null
    try {
      await rescheduleAppointment(client, slug, a.id, startAt.toISOString())
      setMoved({ id: a.id, startAt, endAt, doneAt: Date.now() })
    } catch (err) {
      failure = asApiError(err)
      setMoved(null)
    } finally {
      busy.current = false
      setInFlight(false)
      // Başarıda da başarısızlıkta da liste yenilenir: durum başka yerde değişmiş olabilir (kilitli, silinmiş, dolu).
      onChanged()
    }
    return failure
  }

  async function undo(a: DayAppointment) {
    if (busy.current) {
      setError(MOVE_IN_PROGRESS)
      return
    }
    const failure = await send(a, a.start, a.end)
    if (!failure) {
      setError(null)
      toast.show({ message: 'Taşıma geri alındı.' })
    } else setError(failure.code === 'SLOT_TAKEN' ? UNDO_FAILED_TAKEN : failure.text())
  }

  async function move(a: DayAppointment, target: DropTarget) {
    if (busy.current) {
      setError(MOVE_IN_PROGRESS)
      return
    }
    setError(null)
    const startAt = new Date(target.startAt)
    const endAt = new Date(startAt.getTime() + (a.end.getTime() - a.start.getTime()))
    const failure = await send(a, startAt, endAt)
    if (failure) {
      setError(failure.text())
      return
    }
    toast.show({
      message: moveToast(clockLabel(startAt)),
      undo: () => void undo(a),
    })
  }

  return {
    pending,
    busy: inFlight,
    error,
    move,
    clearError: () => setError(null),
  }
}
