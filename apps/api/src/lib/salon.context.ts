import type { SalonContext } from '../ai/intent.service'
import { TEST_SALON } from '../ai/intent.service'

// MVP: Sabit test salonu döndürür.
// Sonraki adımda: tenantId ile veritabanından gerçek salon bilgisi çekilecek.
export async function getSalon(_tenantId: string): Promise<SalonContext> {
  return TEST_SALON
}
