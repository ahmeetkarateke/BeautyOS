import { z } from 'zod'
import type { PermissionKey, Role } from '@beautyos/shared'
import { TERM_SETS } from '@/content/terms'

// GET /api/v1/auth/me yanıtı (A1 sözleşmesi: apps/api/src/lib/me-profile.ts). Sunucudan gelen veri güvenilmez girdi sayılır:
// şema dışı yanıt hata verir (kapalı başarısızlık). Kiracı bilgisi yalnız görüntü içindir; yetki kararı sunucudadır.
const meSchema = z.object({
  role: z.string(),
  permissions: z.array(z.string()),
  staffId: z.string().nullable(),
  user: z.object({ id: z.string(), email: z.string(), name: z.string() }),
  tenant: z.object({
    slug: z.string(),
    name: z.string(),
    businessType: z.string(),
    termSet: z.enum(TERM_SETS),
    terms: z.record(z.string()),
    activeModules: z.array(z.string()),
    bookingMode: z.enum(['verified', 'approval_required']),
    timezone: z.string(),
  }),
})

export type Me = Omit<z.infer<typeof meSchema>, 'role' | 'permissions'> & { role: Role; permissions: PermissionKey[] }

export function parseMe(input: unknown): Me {
  // role ve permissions paylaşılan paketin türleriyle daraltılır; bilinmeyen izin anahtarı kullanım yerinde zaten eşleşmez.
  return meSchema.parse(input) as Me
}
