import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const hash = '$2b$10$tzb9Iv1o1bugzFtr8ZmJ8ulMwRLVGTFx8gIJvo//7M/RZ9pZG9r42'

  // Tenant upsert
  const tenant = await db.tenant.upsert({
    where: { slug: 'demo-salon' },
    update: {},
    create: {
      name: 'Demo Güzellik Salonu',
      slug: 'demo-salon',
      plan: 'pro',
      telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
      settings: { workingHours: '09:00-19:00', address: 'İstanbul, Türkiye' },
    },
  })
  console.log(`Tenant: ${tenant.name} — ${tenant.id}`)

  // Owner user upsert with real password hash
  const user = await db.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'demo@beautyos.app' } },
    update: { passwordHash: hash, isActive: true },
    create: {
      tenantId: tenant.id,
      email: 'demo@beautyos.app',
      passwordHash: hash,
      role: 'owner',
      fullName: 'Demo Salon Sahibi',
      phone: '+90 555 000 00 00',
      isActive: true,
    },
  })
  console.log(`User: ${user.email} — şifre: Demo1234!`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
