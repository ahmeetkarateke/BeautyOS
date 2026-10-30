import { z } from 'zod'
import type { ApiClient } from '@/lib/v2/api-client'

// Bot konuşmaları (yalnız sahip). customerRef kasıtlı olarak şemada yok: kişisel tanımlayıcı ekrana taşınmaz.
const conversationSchema = z.object({
  id: z.string(),
  channel: z.string(),
  outcome: z.string().nullish(),
  referenceCode: z.string().nullish(),
  turnCount: z.number(),
  startedAt: z.string(),
  endedAt: z.string().nullish(),
})
export type Conversation = z.infer<typeof conversationSchema>

const pageSchema = z.object({
  data: z.array(conversationSchema),
  meta: z.object({ total: z.number(), page: z.number(), totalPages: z.number() }),
})
export type ConversationPage = z.infer<typeof pageSchema>

export async function fetchConversations(client: ApiClient, slug: string, page: number, signal?: AbortSignal): Promise<ConversationPage> {
  return pageSchema.parse(
    await client.request<unknown>(`/api/v1/tenants/${encodeURIComponent(slug)}/bot-conversations`, { query: { page, limit: 20 }, signal }),
  )
}
