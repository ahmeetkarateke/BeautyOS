'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { resolveActiveModules } from '@/lib/modules'

interface TenantSettingsResponse {
  settings?: {
    activeModules?: unknown
  } | null
}

/**
 * Mevcut tenant'ın aktif modüllerini döner.
 * activeModules eksik/boş ise tüm modüller döner (varsayılan davranış).
 *
 * `activeModules` referansı useMemo ile stabilize edilir — aksi halde
 * her render'da yeni array dönüp consumer Set/effect deps'leri tetikler.
 */
export function useActiveModules(tenantSlug: string): {
  activeModules: string[]
  isLoading: boolean
} {
  const { data, isLoading } = useQuery({
    queryKey: ['tenant-settings', tenantSlug],
    queryFn: () => apiFetch<TenantSettingsResponse>(`/api/v1/tenants/${tenantSlug}/settings`),
    enabled: Boolean(tenantSlug),
    staleTime: 60_000,
    retry: false, // 401/404'te retry yapma; donma riskini azalt
  })

  const activeModules = useMemo(
    () => resolveActiveModules(data?.settings?.activeModules),
    [data?.settings?.activeModules],
  )
  return { activeModules, isLoading }
}
