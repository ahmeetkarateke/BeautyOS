import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '../../lib/db'

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret'

// ─── DB güvenlik kontrolleri ─────────────────────────────────────────────────
// Hem production hem staging DB'ye test çalıştırmayı engelle.
// Veri kaybı riski: test cleanup tenant'lar siler; bug olursa real veriyi alır.
const dbUrl = process.env.DATABASE_URL ?? ''
const FORBIDDEN_DB_IDENTIFIERS = [
  'kpoqwdamkmdjntbgjbxy', // production Supabase ref
  'lnrobattysyfoljalndu', // staging Supabase ref
  '.supabase.co',         // herhangi bir paylaşılan Supabase host
  '.pooler.supabase.com', // Supabase pooler (staging dahil)
]
if (FORBIDDEN_DB_IDENTIFIERS.some((id) => dbUrl.includes(id))) {
  throw new Error(
    'Tests cannot run against production/staging DATABASE_URL. ' +
    'Use an ephemeral test database (CI service container or local Postgres). ' +
    `Got host: ${dbUrl.replace(/:[^@]+@/, ':***@').replace(/\/[^?]+/, '/***')}`,
  )
}

// ─── Sadece test slug'lı tenant'lar silinebilir ─────────────────────────────
// cleanupTenant yanlış bir ID alırsa veya bug nedeniyle gerçek bir tenant'ı
// silmeye çalışırsa engelliyor. Son savunma katmanı.
const TEST_SLUG_PREFIXES = ['tst-', 'test-']
async function isTestTenant(tenantId: string): Promise<boolean> {
  const t = await db.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } })
  if (!t) return true // zaten yok, silmeyi denemek zararsız
  return TEST_SLUG_PREFIXES.some((p) => t.slug.startsWith(p))
}

export function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export async function createTestTenant(suffix: string) {
  return db.tenant.create({
    data: {
      name: `Test Salon ${suffix}`,
      slug: `tst-${suffix}`,
      plan: 'basic',
      isActive: true,
    },
  })
}

export async function createTestOwner(tenantId: string, tenantSlug: string, suffix: string) {
  const password = 'TestPass12!'
  const passwordHash = await bcrypt.hash(password, 10)
  const user = await db.user.create({
    data: {
      tenantId,
      email: `owner-${suffix}@test.local`,
      passwordHash,
      fullName: `Test Owner ${suffix}`,
      role: 'owner',
      isActive: true,
    },
  })
  const token = jwt.sign(
    { userId: user.id, tenantId, tenantSlug, role: 'owner' },
    JWT_SECRET,
    { expiresIn: '1h' },
  )
  return { user, token, password }
}

export async function createTestManager(tenantId: string, tenantSlug: string, suffix: string) {
  const password = 'TestPass12!'
  const passwordHash = await bcrypt.hash(password, 10)
  const user = await db.user.create({
    data: {
      tenantId,
      email: `manager-${suffix}@test.local`,
      passwordHash,
      fullName: `Test Manager ${suffix}`,
      role: 'manager',
      isActive: true,
    },
  })
  const token = jwt.sign(
    { userId: user.id, tenantId, tenantSlug, role: 'manager' },
    JWT_SECRET,
    { expiresIn: '1h' },
  )
  return { user, token, password }
}

export async function createTestStaff(tenantId: string, tenantSlug: string, suffix: string) {
  const password = 'TestPass12!'
  const passwordHash = await bcrypt.hash(password, 10)
  const user = await db.user.create({
    data: {
      tenantId,
      email: `staff-${suffix}@test.local`,
      passwordHash,
      fullName: `Test Staff ${suffix}`,
      role: 'staff',
      isActive: true,
    },
  })
  const profile = await db.staffProfile.create({
    data: {
      userId: user.id,
      tenantId,
      title: 'Test Uzmanı',
      colorCode: 42,
    },
  })
  const token = jwt.sign(
    { userId: user.id, tenantId, tenantSlug, role: 'staff' },
    JWT_SECRET,
    { expiresIn: '1h' },
  )
  return { user, profile, token, password }
}

export async function createTestService(tenantId: string, suffix: string) {
  return db.service.create({
    data: {
      tenantId,
      name: `Test Hizmet ${suffix}`,
      durationMinutes: 60,
      price: 150,
      isActive: true,
      isOnlineBookable: true,
    },
  })
}

export async function createTestCustomer(tenantId: string, phone: string, suffix: string) {
  return db.customer.create({
    data: {
      tenantId,
      fullName: `Test Müşteri ${suffix}`,
      phone,
    },
  })
}

export async function cleanupTenant(tenantId: string) {
  // KRİTİK GÜVENLİK: sadece "tst-"/"test-" prefix'li tenant'ları sil.
  // cleanup yanlış ID alırsa veya buggy bir test gerçek tenant'ı silmek
  // isterse engelliyor. Üçüncü savunma katmanı.
  const isTest = await isTestTenant(tenantId)
  if (!isTest) {
    throw new Error(
      `cleanupTenant refused: tenant ${tenantId} is NOT a test tenant ` +
      `(slug prefix must be 'tst-' or 'test-'). If CI hit this, a test created ` +
      `a tenant without the required prefix — please fix.`,
    )
  }

  // Cleanup tüm CASCADE-bağlı child tabloları siler. Yeni model eklendikçe
  // buraya da eklenmeli — yoksa tenant.delete FK constraint hatası verir
  // ve önceki user.deleteMany çalışmış olur → orphan'lar.
  try {
    // Yeni modüller (CASCADE bağımlı child kayıtlar)
    await db.packageUsage.deleteMany({ where: { tenantId } })
    await db.customerPackage.deleteMany({ where: { tenantId } })
    await db.servicePackage.deleteMany({ where: { tenantId } })
    await db.tipDistribution.deleteMany({ where: { tenantId } })
    await db.tipEntry.deleteMany({ where: { tenantId } })
    await db.customerAnamnesisAnswer.deleteMany({ where: { tenantId } })
    await db.anamnesisQuestion.deleteMany({ where: { tenantId } })
    await db.customerPhoto.deleteMany({ where: { tenantId } })
    await db.staffPayout.deleteMany({ where: { tenantId } })
    await db.stockMovement.deleteMany({ where: { tenantId } })
    await db.serviceInventoryRecipe.deleteMany({ where: { tenantId } })
    await db.supplier.deleteMany({ where: { tenantId } })
    await db.waitlist.deleteMany({ where: { tenantId } })
    await db.activityLog.deleteMany({ where: { tenantId } })

    // Mevcut child'lar
    await db.notificationLog.deleteMany({ where: { tenantId } })
    await db.transaction.deleteMany({ where: { tenantId } })
    await db.expense.deleteMany({ where: { tenantId } })
    await db.inventoryItem.deleteMany({ where: { tenantId } })
    await db.appointment.deleteMany({ where: { tenantId } })
    await db.staffLeave.deleteMany({ where: { tenantId } })
    await db.staffServiceAssignment.deleteMany({ where: { tenantId } })
    await db.customer.deleteMany({ where: { tenantId } })
    await db.staffProfile.deleteMany({ where: { tenantId } })
    await db.user.deleteMany({ where: { tenantId } })
    await db.resource.deleteMany({ where: { tenantId } })
    await db.service.deleteMany({ where: { tenantId } })
    await db.tenant.delete({ where: { id: tenantId } })
  } catch (e) {
    // Hata yutulmaz: artık veri bırakan FK hatası testi kırmızıya çevirmelidir.
    throw new Error(`cleanupTenant failed for ${tenantId}: ${(e as Error).message}`)
  }
}
