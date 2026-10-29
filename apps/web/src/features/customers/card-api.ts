import { z } from 'zod'
import type { ApiClient } from '@/lib/v2/api-client'
import type { CardDetail } from './card-logic'

// Müşteri kartı uçları. Sunucu yanıtı güvenilmez girdi sayılır: zod ile doğrulanır.
const base = (slug: string, id: string) => `/api/v1/tenants/${encodeURIComponent(slug)}/customers/${encodeURIComponent(id)}`

const cardSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  birthDate: z.string().nullish(),
  allergyNotes: z.string().nullish(),
  preferenceNotes: z.string().nullish(),
  totalVisits: z.number(),
  lifetimeValue: z.number(),
  segment: z.string().nullish(),
  lastVisitAt: z.string().nullish(),
  marketingConsentSms: z.boolean(),
  marketingConsentEmail: z.boolean(),
  appointments: z.array(
    z.object({
      id: z.string(),
      startTime: z.string(),
      endTime: z.string(),
      status: z.string(),
      priceCharged: z.number(),
      serviceName: z.string(),
      staffName: z.string(),
    }),
  ),
})

export async function fetchCustomerCard(client: ApiClient, slug: string, id: string, signal?: AbortSignal): Promise<CardDetail> {
  return cardSchema.parse(await client.request<unknown>(base(slug, id), { signal }))
}

const anamnesisSchema = z.object({
  questions: z.array(z.object({ id: z.string(), label: z.string(), type: z.string(), order: z.number().optional() })),
  answers: z.array(z.object({ questionId: z.string(), value: z.unknown().nullable() })),
})
export type Anamnesis = z.infer<typeof anamnesisSchema>

export async function fetchAnamnesis(client: ApiClient, slug: string, id: string, signal?: AbortSignal): Promise<Anamnesis> {
  return anamnesisSchema.parse(await client.request<unknown>(`${base(slug, id)}/anamnesis`, { signal }))
}
