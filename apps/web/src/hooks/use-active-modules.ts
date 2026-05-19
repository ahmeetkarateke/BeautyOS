'use client'

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
  })

  const activeModules = resolveActiveModules(data?.settings?.activeModules)
  return { activeModules, isLoading }
}
