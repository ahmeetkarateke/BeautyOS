'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, ClipboardList } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'

type QType = 'short_text' | 'long_text' | 'yes_no' | 'single_choice' | 'multi_choice' | 'date' | 'number'

interface AnamnesisQuestion {
  id: string
  label: string
  type: QType
  options?: string[] | null
  helperText?: string | null
  isRequired: boolean
  order: number
}

interface AnamnesisAnswer {
  questionId: string
  value: unknown
  updatedAt: string | null
}

interface Response {
  questions: AnamnesisQuestion[]
  answers: AnamnesisAnswer[]
}

interface Props {
  tenantSlug: string
  customerId: string
}

type AnswerMap = Record<string, unknown>

function emptyValueForType(type: QType): unknown {
  switch (type) {
    case 'yes_no': return null
    case 'multi_choice': return []
    default: return ''
  }
}

export function AnamnesisForm({ tenantSlug, customerId }: Props) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<AnswerMap>({})
  const [dirty, setDirty] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['anamnesis', tenantSlug, customerId],
    queryFn: () =>
      apiFetch<Response>(`/api/v1/tenants/${tenantSlug}/customers/${customerId}/anamnesis`),
  })

  // Server cevaplarını draft state'ine doldur
  useEffect(() => {
    if (!data) return
    const next: AnswerMap = {}
    for (const a of data.answers) {
      next[a.questionId] = a.value ?? emptyValueForType(
        data.questions.find((q) => q.id === a.questionId)?.type ?? 'short_text',
      )
    }
    for (const q of data.questions) {
      if (!(q.id in next)) next[q.id] = emptyValueForType(q.type)
    }
    setDraft(next)
    setDirty(false)
  }, [data])

  const mutation = useMutation({
    mutationFn: (answers: AnswerMap) =>
      apiFetch(`/api/v1/tenants/${tenantSlug}/customers/${customerId}/anamnesis`, {
        method: 'PUT',
        body: JSON.stringify({
          answers: Object.entries(answers).map(([questionId, value]) => ({ questionId, value })),
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['anamnesis', tenantSlug, customerId] })
      toast('Anamnez kaydedildi')
      setDirty(false)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const questions = useMemo(() => data?.questions ?? [], [data])

  function update(id: string, value: unknown) {
    setDraft((prev) => ({ ...prev, [id]: value }))
    setDirty(true)
  }

  function handleSave() {
    // Required validation
    const missing = questions.filter((q) => {
      if (!q.isRequired) return false
      const v = draft[q.id]
      if (v === null || v === undefined || v === '') return true
      if (Array.isArray(v) && v.length === 0) return true
      return false
    })
    if (missing.length > 0) {
      toast(`Zorunlu alan eksik: ${missing[0].label}`, 'error')
      return
    }
    mutation.mutate(draft)
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Müşteri Hakkında</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent>
      </Card>
    )
  }

  if (!questions.length) {
    return (
      <Card>
        <CardHeader><CardTitle>Müşteri Hakkında</CardTitle></CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <ClipboardList className="w-10 h-10 mx-auto text-salon-muted opacity-40" />
            <p className="text-sm text-salon-muted mt-3">
              Henüz tanımlı anamnez sorusu yok.
            </p>
            <p className="text-xs text-salon-muted mt-1">
              Ayarlar → Anamnez Soruları üzerinden ekleyebilirsiniz.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Müşteri Hakkında</CardTitle>
        <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={!dirty || mutation.isPending}>
          <Save className="w-3.5 h-3.5" />
          {mutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {questions.map((q) => (
          <QuestionField
            key={q.id}
            question={q}
            value={draft[q.id]}
            onChange={(v) => update(q.id, v)}
          />
        ))}
      </CardContent>
    </Card>
  )
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: AnamnesisQuestion
  value: unknown
  onChange: (v: unknown) => void
}) {
  const id = `anam-${question.id}`
  const labelEl = (
    <Label htmlFor={id} className="flex items-start gap-1">
      <span>{question.label}</span>
      {question.isRequired && <span className="text-red-500">*</span>}
    </Label>
  )
  const helper = question.helperText ? (
    <p className="text-xs text-salon-muted mt-1">{question.helperText}</p>
  ) : null

  switch (question.type) {
    case 'short_text':
      return (
        <div className="space-y-1.5">
          {labelEl}
          <Input id={id} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} maxLength={500} />
          {helper}
        </div>
      )
    case 'long_text':
      return (
        <div className="space-y-1.5">
          {labelEl}
          <Textarea id={id} rows={3} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} maxLength={5000} />
          {helper}
        </div>
      )
    case 'number':
      return (
        <div className="space-y-1.5">
          {labelEl}
          <Input
            id={id}
            type="number"
            value={value === null || value === undefined || value === '' ? '' : String(value)}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          />
          {helper}
        </div>
      )
    case 'date':
      return (
        <div className="space-y-1.5">
          {labelEl}
          <Input
            id={id}
            type="date"
            value={typeof value === 'string' && value ? value.slice(0, 10) : ''}
            onChange={(e) => onChange(e.target.value)}
          />
          {helper}
        </div>
      )
    case 'yes_no': {
      const v = value as boolean | null | undefined
      return (
        <div className="space-y-1.5">
          {labelEl}
          <div className="flex gap-2" role="radiogroup" aria-labelledby={id}>
            <button
              type="button"
              onClick={() => onChange(v === true ? null : true)}
              className={`px-4 py-2 rounded-md border text-sm transition-colors ${
                v === true
                  ? 'border-primary bg-primary-100 text-primary font-medium'
                  : 'border-salon-border bg-white text-salon-muted hover:text-gray-900'
              }`}
            >
              Evet
            </button>
            <button
              type="button"
              onClick={() => onChange(v === false ? null : false)}
              className={`px-4 py-2 rounded-md border text-sm transition-colors ${
                v === false
                  ? 'border-primary bg-primary-100 text-primary font-medium'
                  : 'border-salon-border bg-white text-salon-muted hover:text-gray-900'
              }`}
            >
              Hayır
            </button>
          </div>
          {helper}
        </div>
      )
    }
    case 'single_choice': {
      const opts = question.options ?? []
      const v = (value as string | null) ?? null
      return (
        <div className="space-y-1.5">
          {labelEl}
          <div className="flex flex-wrap gap-2">
            {opts.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => onChange(v === o ? null : o)}
                className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                  v === o
                    ? 'border-primary bg-primary-100 text-primary font-medium'
                    : 'border-salon-border bg-white text-salon-muted hover:text-gray-900'
                }`}
              >
                {o}
              </button>
            ))}
          </div>
          {helper}
        </div>
      )
    }
    case 'multi_choice': {
      const opts = question.options ?? []
      const vArr = Array.isArray(value) ? (value as string[]) : []
      return (
        <div className="space-y-1.5">
          {labelEl}
          <div className="flex flex-wrap gap-2">
            {opts.map((o) => {
              const selected = vArr.includes(o)
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() =>
                    onChange(selected ? vArr.filter((x) => x !== o) : [...vArr, o])
                  }
                  className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                    selected
                      ? 'border-primary bg-primary-100 text-primary font-medium'
                      : 'border-salon-border bg-white text-salon-muted hover:text-gray-900'
                  }`}
                >
                  {o}
                </button>
              )
            })}
          </div>
          {helper}
        </div>
      )
    }
    default:
      return null
  }
}
