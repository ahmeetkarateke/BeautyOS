import { db } from './db'
import type { SalonContext } from '../ai/intent.service'

/** Kiracı yoksa null: bot kurgusal bir salonla yanıt vermez, çağıran mesajı düşürür (S5 K1). */
export async function getSalon(tenantId: string): Promise<SalonContext | null> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    include: {
      services: { where: { isActive: true } },
      staffProfiles: true,
    },
  })

  if (!tenant) return null

  const settings = tenant.settings && typeof tenant.settings === 'object'
    ? tenant.settings as Record<string, unknown>
    : {}

  return {
    name: tenant.name,
    services: tenant.services.map((s: { name: string; durationMinutes: number; price: unknown }) => ({
      name: s.name,
      duration: s.durationMinutes,
      price: Number(s.price),
    })),
    staff: tenant.staffProfiles.map((sp: { title: string }) => ({
      name: sp.title,
      title: sp.title,
    })),
    workingHours: settings['workingHours'] as string ?? '09:00-19:00',
    address: settings['address'] as string ?? '',
    botIntro: settings['botIntro'] as string | undefined,
    botTone: settings['botTone'] as 'formal' | 'friendly' | 'energetic' | undefined,
    botRules: settings['botRules'] as string | undefined,
    botFaqs: settings['botFaqs'] as Array<{ question: string; answer: string }> | undefined,
    botHidePrices: settings['botHidePrices'] as boolean | undefined,
  }
}
