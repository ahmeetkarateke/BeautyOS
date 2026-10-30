import { z } from 'zod'
import type { ApiClient } from '@/lib/v2/api-client'

// Ayarlar uçları. Sunucu yanıtı güvenilmez girdi sayılır: zod ile doğrulanır.
const url = (slug: string) => `/api/v1/tenants/${encodeURIComponent(slug)}/settings`

const settingsSchema = z.object({
  name: z.string(),
  settings: z
    .object({
      phone: z.string().nullish(),
      address: z.string().nullish(),
      workingHours: z.unknown().optional(),
      publicBookingEnabled: z.boolean().nullish(),
      onlineBookingApproval: z.enum(['auto', 'manual']).nullish(),
      whatsappNumber: z.string().nullish(),
      aboutText: z.string().nullish(),
      activeModules: z.array(z.string()).nullish(),
    })
    .passthrough()
    .nullish(),
})
export type SalonSettings = z.infer<typeof settingsSchema>

export async function fetchSettings(client: ApiClient, slug: string, signal?: AbortSignal): Promise<SalonSettings> {
  return settingsSchema.parse(await client.request<unknown>(url(slug), { signal }))
}

export async function patchSettings(client: ApiClient, slug: string, payload: Record<string, unknown>): Promise<void> {
  await client.request<unknown>(url(slug), { method: 'PATCH', body: payload })
}
