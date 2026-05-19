'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Sparkles } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import {
  MODULE_REGISTRY,
  MODULE_KEYS,
  MODULE_TEMPLATES,
  MODULE_TEMPLATE_META,
  MODULE_CATEGORY_LABELS,
  REQUIRED_MODULE_KEYS,
  resolveActiveModules,
  type ModuleCategory,
  type ModuleDef,
} from '@/lib/modules'

interface TenantSettingsResponse {
  settings?: {
    activeModules?: unknown
  } | null
}

const CATEGORY_ORDER: ModuleCategory[] = ['core', 'staff', 'finance', 'inventory', 'automation', 'marketing']

export function ModulesPanel({ tenantSlug }: { tenantSlug: string }) {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['tenant-settings', tenantSlug],
    queryFn: () => apiFetch<TenantSettingsResponse>(`/api/v1/tenants/${tenantSlug}/settings`),
  })

  const serverActive = useMemo(
    () => resolveActiveModules(data?.settings?.activeModules),
    [data],
  )

  const [selected, setSelected] = useState<Set<string>>(new Set(serverActive))

  useEffect(() => {
    setSelected(new Set(serverActive))
  }, [serverActive])

  const mutation = useMutation({
    mutationFn: (activeModules: string[]) =>
      apiFetch<TenantSettingsResponse>(`/api/v1/tenants/${tenantSlug}/settings`, {
        method: 'PATCH',
        body: JSON.stringify({ activeModules }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-settings', tenantSlug] })
      toast('Aktif modüller kaydedildi')
    },
    onError: () => {
      toast('Modüller kaydedilemedi', 'error')
    },
  })

  const grouped = useMemo(() => {
    const map = new Map<ModuleCategory, ModuleDef[]>()
    for (const m of MODULE_REGISTRY) {
      const list = map.get(m.category) ?? []
      list.push(m)
      map.set(m.category, list)
    }
    return map
  }, [])

  const requiredSet = useMemo(() => new Set(REQUIRED_MODULE_KEYS), [])

  const toggle = (key: string) => {
    // Required modüller (dashboard, settings) kapatılamaz — kullanıcının
    // ayarlardan geri açabilmesini garanti et.
    if (requiredSet.has(key)) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const applyTemplate = (templateKey: string) => {
    const keys = MODULE_TEMPLATES[templateKey]
    if (!keys) return
    // Required modülleri her şablona zorla ekle
    const merged = new Set<string>(keys)
    for (const k of REQUIRED_MODULE_KEYS) merged.add(k)
    setSelected(merged)
  }

  const isDirty = useMemo(() => {
    if (selected.size !== serverActive.length) return true
    for (const k of serverActive) if (!selected.has(k)) return true
    return false
  }, [selected, serverActive])

  const handleSave = () => {
    const ordered = MODULE_KEYS.filter((k) => selected.has(k))
    mutation.mutate(ordered)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-salon-muted dark:text-white/60">
            Salonunuzda hangi modüllerin görüneceğini seçin. Devre dışı bıraktığınız modüller menüden gizlenir.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-xs text-amber-600 dark:text-amber-400">Kaydedilmemiş değişiklikler</span>
          )}
          <Button onClick={handleSave} disabled={!isDirty || mutation.isPending}>
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Kaydet
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <div className="space-y-5">
          {CATEGORY_ORDER.map((cat) => {
            const items = grouped.get(cat)
            if (!items || items.length === 0) return null
            return (
              <Card key={cat}>
                <CardHeader>
                  <CardTitle className="text-base">{MODULE_CATEGORY_LABELS[cat]}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {items.map((m) => {
                    const on = selected.has(m.key)
                    const isRequired = requiredSet.has(m.key)
                    return (
                      <button
                        type="button"
                        key={m.key}
                        onClick={() => toggle(m.key)}
                        disabled={isRequired}
                        className={cn(
                          'w-full flex items-start justify-between gap-4 p-3 rounded-md border text-left transition-colors',
                          isRequired && 'opacity-70 cursor-not-allowed',
                          on
                            ? 'border-primary/40 bg-primary-50/40 dark:bg-primary/10'
                            : 'border-salon-border hover:bg-salon-bg dark:border-white/10 dark:hover:bg-white/5',
                        )}
                        title={isRequired ? 'Bu modül devre dışı bırakılamaz' : undefined}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900 dark:text-white">{m.label}</span>
                            {isRequired ? (
                              <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                Zorunlu
                              </span>
                            ) : m.category === 'core' && (
                              <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                Önerilen
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-salon-muted dark:text-white/50 mt-0.5">{m.description}</p>
                        </div>
                        <SwitchPill on={on} />
                      </button>
                    )
                  })}
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Şablonlar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-salon-muted dark:text-white/50 mb-2">
                İşletme türünüze göre hazır bir set seçin. Sonra ince ayar yapabilirsiniz.
              </p>
              {MODULE_TEMPLATE_META.map((t) => {
                const keys = MODULE_TEMPLATES[t.key] ?? []
                const matches = keys.length === selected.size && keys.every((k) => selected.has(k))
                return (
                  <button
                    type="button"
                    key={t.key}
                    onClick={() => applyTemplate(t.key)}
                    className={cn(
                      'w-full text-left p-3 rounded-md border transition-colors',
                      matches
                        ? 'border-primary/40 bg-primary-50/40 dark:bg-primary/10'
                        : 'border-salon-border hover:bg-salon-bg dark:border-white/10 dark:hover:bg-white/5',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900 dark:text-white">{t.label}</span>
                      <span className="text-[11px] text-salon-muted dark:text-white/50">
                        {keys.length} modül
                      </span>
                    </div>
                    <p className="text-xs text-salon-muted dark:text-white/50 mt-0.5">{t.description}</p>
                  </button>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function SwitchPill({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        'relative inline-flex h-6 w-10 flex-shrink-0 rounded-full transition-colors',
        on ? 'bg-primary' : 'bg-gray-300 dark:bg-white/15',
      )}
      aria-hidden
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all',
          on ? 'left-[18px]' : 'left-0.5',
        )}
      />
    </span>
  )
}
