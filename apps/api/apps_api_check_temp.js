const { PrismaClient } = require('@prisma/client')
const URL = 'postgresql://postgres.lnrobattysyfoljalndu:L%2FgrHs4bu%26E%26%2F%26T@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1'
const prisma = new PrismaClient({ datasources: { db: { url: URL } } })

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, fullName: true, isActive: true, tenantId: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  console.log(`Staging DB'de ${users.length} kullanıcı:`)
  for (const u of users) {
    console.log(`  ${u.email} | ${u.role} | ${u.fullName} | active=${u.isActive} | tenant=${u.tenantId?.slice(0,8) ?? 'null'}`)
  }
  await prisma.$disconnect()
}
main().catch(e => { console.error(e.message); process.exit(1) })
