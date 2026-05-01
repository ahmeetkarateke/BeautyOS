import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '../../lib/db'

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret'

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
  try {
    await db.notificationLog.deleteMany({ where: { tenantId } })
    await db.transaction.deleteMany({ where: { tenantId } })
    await db.appointment.deleteMany({ where: { tenantId } })
    await db.staffLeave.deleteMany({ where: { tenantId } })
    await db.staffServiceAssignment.deleteMany({ where: { tenantId } })
    await db.customer.deleteMany({ where: { tenantId } })
    await db.staffProfile.deleteMany({ where: { tenantId } })
    await db.user.deleteMany({ where: { tenantId } })
    await db.service.deleteMany({ where: { tenantId } })
    await db.tenant.delete({ where: { id: tenantId } })
  } catch {
    // best-effort cleanup
  }
}
