/**
 * Süper yönetici oluşturur ya da şifresini günceller (HTTP ucu yok; S7-K3).
 *
 * Kullanım (sunucuda api konteynerinde ya da yerelde):
 *   SUPERADMIN_EMAIL=ad@ornek.com SUPERADMIN_PASSWORD='...' npx tsx scripts/create-superadmin.ts
 *
 * E-posta ve şifre komut satırı argümanı olarak verilmez (kabuk geçmişine ve süreç listesine düşer); ortam değişkeni
 * yalnız bu komutun ömrü boyunca verilir, .env dosyasına yazılmaz.
 */
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { BCRYPT_COST, normalizeEmail } from '../src/lib/credentials'
import { strongPassword } from '../src/lib/password-policy'

async function main(): Promise<void> {
  const rawEmail = process.env.SUPERADMIN_EMAIL
  const rawPassword = process.env.SUPERADMIN_PASSWORD
  if (!rawEmail || !rawPassword) {
    throw new Error('SUPERADMIN_EMAIL ve SUPERADMIN_PASSWORD ortam değişkenleri gerekli.')
  }
  const email = normalizeEmail(rawEmail)
  const password = strongPassword.safeParse(rawPassword)
  if (!password.success) {
    throw new Error(password.error.errors[0]?.message ?? 'Şifre kuralı sağlanmıyor.')
  }

  const db = new PrismaClient()
  try {
    const passwordHash = await bcrypt.hash(password.data, BCRYPT_COST)
    const existing = await db.user.findFirst({ where: { role: 'superadmin' }, select: { id: true } })
    if (existing) {
      await db.user.update({ where: { id: existing.id }, data: { email, passwordHash, isActive: true } })
      console.log('Süper yönetici güncellendi.')
    } else {
      await db.user.create({ data: { email, passwordHash, fullName: 'Super Admin', role: 'superadmin', isActive: true } })
      console.log('Süper yönetici oluşturuldu.')
    }
  } finally {
    await db.$disconnect()
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : 'Bilinmeyen hata')
  process.exit(1)
})
