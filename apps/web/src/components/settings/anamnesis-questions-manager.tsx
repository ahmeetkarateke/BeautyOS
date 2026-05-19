'use client'

import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, ChevronUp, ChevronDown, Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'

type QType = 'short_text' | 'long_text' | 'yes_no' | 'single_choice' | 'multi_choice' | 'date' | 'number'

interface Question {
  id: string
  label: string
  type: QType
  options: string[] | null
  helperText: string | null
  isRequired: boolean
  isCustom: boolean
  isActive: boolean
  order: number
}

const TYPE_LABELS: Record<QType, string> = {
  short_text: 'Kısa Metin',
  long_text: 'Uzun Metin',
  yes_no: 'Evet / Hayır',
  single_choice: 'Tekli Seçim',
  multi_choice: 'Çoklu Seçim',
  date: 'Tarih',
  number: 'Sayı',
}

interface Props {
  tenantSlug: string
}

export function AnamnesisQuestionsManager({ tenantSlug }: Props) {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Question | null>(null)
  const [toDelete, setToDelete] = useState<Question | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['anamnesis-questions', tenantSlug],
    queryFn: () =>
      apiFetch<Question[]>(`/api/v1/tenants/${tenantSlug}/anamnesis-questions?includeInactive=true`),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/tenants/${tenantSlug}/anamnesis-questions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['anamnesis-questions', tenantSlug] })
      toast('Soru kaldırıldı')
      setToDelete(null)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const reorderMutation = useMutation({
    mutationFn: ({ id, order }: { id: string; order: number }) =>
      apiFetch(`/api/v1/tenants/${tenantSlug}/anamnesis-questions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ order }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['anamnesis-questions', tenantSlug] }),
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiFetch(`/api/v1/tenants/${tenantSlug}/anamnesis-questions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['anamnesis-questions', tenantSlug] }),
    onError: (err: Error) => toast(err.message, 'error'),
  })

  function moveUp(idx: number) {
    if (!data || idx === 0) return
    const a = data[idx]
    const b = data[idx - 1]
    reorderMutation.mutate({ id: a.id, order: b.order })
    reorderMutation.mutate({ id: b.id, order: a.order })
  }
  function moveDown(idx: number) {
    if (!data || idx >= data.length - 1) return
    const a = data[idx]
    const b = data[idx + 1]
    reorderMutation.mutate({ id: a.id, order: b.order })
    reorderMutation.mutate({ id: b.id, order: a.order })
  }

  if (isLoading) {
    return <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => setAdding(true)}>
          <Plus className="w-4 h-4" /> Yeni Soru Ekle
        </Button>
      </div>

      {(data ?? []).length === 0 ? (
        <p className="text-sm text-salon-muted py-6 text-center">Henüz soru yok. İlk soruyu ekleyin.</p>
      ) : (
        <ul className="divide-y divide-salon-border border border-salon-border rounded-lg overflow-hidden bg-white">
          {(data ?? []).map((q, idx) => (
            <li key={q.id} className={`flex items-start gap-3 px-3 py-3 ${q.isActive ? '' : 'opacity-50'}`}>
              <div className="flex flex-col gap-0.5 pt-1">
                <button
                  type="button"
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  className="text-salon-muted hover:text-gray-900 disabled:opacity-30"
                  aria-label="Yukarı taşı"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(idx)}
                  disabled={idx >= (data ?? []).length - 1}
                  className="text-salon-muted hover:text-gray-900 disabled:opacity-30"
                  aria-label="Aşağı taşı"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">{q.label}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-salon-bg border border-salon-border text-salon-muted">
                    {TYPE_LABELS[q.type]}
                  </span>
                  {q.isRequired && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 border border-red-200 text-red-600">Zorunlu</span>
                  )}
                  {!q.isCustom && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-600">Varsayılan</span>
                  )}
                </div>
                {q.helperText && <p className="text-xs text-salon-muted mt-0.5">{q.helperText}</p>}
                {q.options && q.options.length > 0 && (
                  <p className="text-xs text-salon-muted mt-1">Seçenekler: {q.options.join(', ')}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => toggleActiveMutation.mutate({ id: q.id, isActive: !q.isActive })}
                  className="px-2 py-1 text-[11px] rounded border border-salon-border text-salon-muted hover:text-gray-900"
                >
                  {q.isActive ? 'Gizle' : 'Göster'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(q)}
                  className="p-1.5 rounded-md text-salon-muted hover:text-primary hover:bg-primary-100"
                  aria-label="Düzenle"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setToDelete(q)}
                  className="p-1.5 rounded-md text-salon-muted hover:text-red-600 hover:bg-red-50"
                  aria-label="Sil"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <QuestionEditor
          tenantSlug={tenantSlug}
          onClose={() => setAdding(false)}
        />
      )}

      {editing && (
        <QuestionEditor
          tenantSlug={tenantSlug}
          question={editing}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => { if (!o) setToDelete(null) }}
        title="Soruyu kaldır"
        description={
          toDelete?.isCustom
            ? 'Bu özel soru ve tüm cevapları kalıcı olarak silinecek.'
            : 'Varsayılan sorular silinemez, sadece gizlenir. Daha sonra "Göster" ile geri açabilirsiniz.'
        }
        confirmLabel={toDelete?.isCustom ? 'Sil' : 'Gizle'}
        loading={deleteMutation.isPending}
        onConfirm={() => { if (toDelete) deleteMutation.mutate(toDelete.id) }}
      />
    </div>
  )
}

function QuestionEditor({
  tenantSlug,
  question,
  onClose,
}: {
  tenantSlug: string
  question?: Question
  onClose: () => void
}) {
  const qc = useQueryClient()
  const isEdit = !!question
  const [label, setLabel] = useState(question?.label ?? '')
  const [type, setType] = useState<QType>(question?.type ?? 'short_text')
  const [helperText, setHelperText] = useState(question?.helperText ?? '')
  const [isRequired, setIsRequired] = useState(question?.isRequired ?? false)
  const [options, setOptions] = useState<string[]>(question?.options ?? [])
  const [newOpt, setNewOpt] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { label, helperText: helperText || null, isRequired }
      if (type === 'single_choice' || type === 'multi_choice') {
        payload.options = options
      }
      if (isEdit) {
        return apiFetch(`/api/v1/tenants/${tenantSlug}/anamnesis-questions/${question!.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      }
      payload.type = type
      return apiFetch(`/api/v1/tenants/${tenantSlug}/anamnesis-questions`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['anamnesis-questions', tenantSlug] })
      toast(isEdit ? 'Soru güncellendi' : 'Soru eklendi')
      onClose()
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  function addOption() {
    const t = newOpt.trim()
    if (!t || options.includes(t)) return
    setOptions([...options, t])
    setNewOpt('')
  }

  function removeOption(o: string) {
    setOptions(options.filter((x) => x !== o))
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (label.trim().length < 2) {
      toast('Soru en az 2 karakter olmalıdır', 'error')
      return
    }
    if ((type === 'single_choice' || type === 'multi_choice') && options.length < 2) {
      toast('Çoktan seçmeli sorular için en az 2 seçenek gereklidir', 'error')
      return
    }
    mutation.mutate()
  }

  const needsOptions = type === 'single_choice' || type === 'multi_choice'

  return (
    <div className="border-2 border-primary/30 rounded-lg p-4 space-y-3 bg-primary/5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">{isEdit ? 'Soruyu Düzenle' : 'Yeni Soru'}</p>
        <button type="button" onClick={onClose} className="text-salon-muted hover:text-gray-900">
          <X className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="q-label">Soru</Label>
          <Input id="q-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={300} />
        </div>

        {!isEdit && (
          <div className="space-y-1.5">
            <Label htmlFor="q-type">Soru Tipi</Label>
            <select
              id="q-type"
              value={type}
              onChange={(e) => setType(e.target.value as QType)}
              className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm bg-white"
            >
              {(Object.keys(TYPE_LABELS) as QType[]).map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
        )}

        {needsOptions && (
          <div className="space-y-1.5">
            <Label>Seçenekler</Label>
            <div className="flex flex-wrap gap-1.5">
              {options.map((o) => (
                <span key={o} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-salon-border text-xs">
                  {o}
                  <button type="button" onClick={() => removeOption(o)} className="text-salon-muted hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newOpt}
                onChange={(e) => setNewOpt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption() } }}
                placeholder="Yeni seçenek"
                maxLength={100}
              />
              <Button type="button" variant="outline" size="sm" onClick={addOption} disabled={!newOpt.trim()}>
                Ekle
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="q-helper">Açıklama / İpucu (opsiyonel)</Label>
          <Textarea id="q-helper" rows={2} value={helperText} onChange={(e) => setHelperText(e.target.value)} maxLength={500} />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} />
          <span>Zorunlu alan</span>
        </label>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">İptal</Button>
          <Button type="submit" disabled={mutation.isPending} className="flex-1">
            {mutation.isPending ? 'Kaydediliyor...' : (isEdit ? 'Güncelle' : 'Ekle')}
          </Button>
        </div>
      </form>
    </div>
  )
}
