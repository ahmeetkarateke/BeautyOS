import { config } from 'dotenv'
import { resolve } from 'path'
// .env her zaman apps/api/ altında
config({ path: resolve(__dirname, '../.env') })

import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})
const adapter = new PrismaPg(pool)
const db = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seed başlıyor...')

  // ─── Tenant ──────────────────────────────────────────────────────────────────
  const tenant = await db.tenant.upsert({
    where: { slug: 'demo-salon' },
    update: {
      telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    },
    create: {
      name: 'Demo Güzellik Salonu',
      slug: 'demo-salon',
      plan: 'pro',
      telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
      settings: {
        workingHours: '09:00-19:00',
        address: 'İstanbul, Türkiye',
        phone: '+90 555 000 00 00',
      },
    },
  })
  console.log(`✅ Tenant: ${tenant.name} (${tenant.id})`)

  // ─── Owner kullanıcı ──────────────────────────────────────────────────────────
  const owner = await db.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'demo@beautyos.app' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'demo@beautyos.app',
      passwordHash: 'PLACEHOLDER_HASH', // Gerçek auth Faza 2'de
      role: 'owner',
      fullName: 'Demo Salon Sahibi',
      phone: '+90 555 000 00 00',
    },
  })
  console.log(`✅ Owner: ${owner.fullName}`)

  // ─── Staff profilleri ─────────────────────────────────────────────────────────
  const staffData = [
    { title: 'Nail Artist', expertise: ['Protez Tırnak', 'Nail Art', 'Manikür', 'Pedikür'] },
    { title: 'Saç Uzmanı', expertise: ['Saç Kesimi', 'Röfle', 'Boya', 'Keratin'] },
    { title: 'Güzellik Uzmanı', expertise: ['Cilt Bakımı', 'Kaş Tasarımı', 'Makyaj'] },
  ]

  const staffProfiles = []
  for (const s of staffData) {
    // Her staff için ayrı user oluştur
    const email = `${s.title.toLowerCase().replace(/\s+/g, '.')}@demo-salon.beautyos.app`
    const user = await db.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email } },
      update: {},
      create: {
        tenantId: tenant.id,
        email,
        passwordHash: 'PLACEHOLDER_HASH',
        role: 'staff',
        fullName: s.title,
      },
    })

    const profile = await db.staffProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        tenantId: tenant.id,
        title: s.title,
        expertiseTags: s.expertise,
        acceptsOnlineBooking: true,
        workingHours: {
          mon: { start: '09:00', end: '19:00' },
          tue: { start: '09:00', end: '19:00' },
          wed: { start: '09:00', end: '19:00' },
          thu: { start: '09:00', end: '19:00' },
          fri: { start: '09:00', end: '19:00' },
          sat: { start: '10:00', end: '17:00' },
          sun: null,
        },
      },
    })
    staffProfiles.push(profile)
    console.log(`✅ Staff: ${s.title} (${profile.id})`)
  }

  // ─── Hizmetler ────────────────────────────────────────────────────────────────
  const services = [
    // Tırnak
    { name: 'Protez Tırnak', category: 'Tırnak', duration: 90, buffer: 10, price: 450, commission: 0.3 },
    { name: 'Manikür', category: 'Tırnak', duration: 45, buffer: 5, price: 200, commission: 0.25 },
    { name: 'Pedikür', category: 'Tırnak', duration: 60, buffer: 5, price: 250, commission: 0.25 },
    { name: 'Nail Art', category: 'Tırnak', duration: 30, buffer: 5, price: 150, commission: 0.3 },
    // Saç
    { name: 'Saç Kesimi', category: 'Saç', duration: 45, buffer: 10, price: 300, commission: 0.25 },
    { name: 'Röfle', category: 'Saç', duration: 120, buffer: 15, price: 800, commission: 0.25 },
    { name: 'Saç Boyama', category: 'Saç', duration: 90, buffer: 15, price: 600, commission: 0.25 },
    { name: 'Keratin Bakımı', category: 'Saç', duration: 150, buffer: 15, price: 1200, commission: 0.2 },
    // Güzellik
    { name: 'Cilt Bakımı', category: 'Cilt', duration: 60, buffer: 10, price: 400, commission: 0.25 },
    { name: 'Kaş Tasarımı', category: 'Güzellik', duration: 30, buffer: 5, price: 150, commission: 0.3 },
    { name: 'Makyaj', category: 'Güzellik', duration: 60, buffer: 10, price: 500, commission: 0.25 },
  ]

  for (const s of services) {
    await db.service.upsert({
      where: {
        // Composite unique yok — name+tenantId üzerinden kontrol
        id: (await db.service.findFirst({ where: { tenantId: tenant.id, name: s.name } }))?.id ?? '00000000-0000-0000-0000-000000000000',
      },
      update: { price: s.price, durationMinutes: s.duration },
      create: {
        tenantId: tenant.id,
        name: s.name,
        category: s.category,
        durationMinutes: s.duration,
        bufferMinutes: s.buffer,
        price: s.price,
        commissionRate: s.commission,
        isActive: true,
      },
    })
    console.log(`✅ Hizmet: ${s.name} — ₺${s.price}`)
  }

  console.log('\n🎉 Seed tamamlandı!')
  console.log(`\nTenant ID: ${tenant.id}`)
  console.log('Bu ID\'yi TELEGRAM_TENANT_ID env var olarak ayarlayın.')
}

main()
  .catch((e) => {
    console.error('❌ Seed hatası:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
    await pool.end()
  })
