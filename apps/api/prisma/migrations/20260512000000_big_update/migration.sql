-- ═══════════════════════════════════════════════════════════════════════════════
-- BIG UPDATE — Paketler + Bahşiş + Müşteri Zenginleştirme + Personel Ödemeleri
--              + Stok Hareketleri + Tedarikçi + Hizmet-Malzeme + Waitlist
--              + Aktivite Logları
-- 2026-05-12
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Enums ─────────────────────────────────────────────────────────────────────
CREATE TYPE "PackageStatus" AS ENUM ('active', 'completed', 'expired', 'refunded');
CREATE TYPE "StockMovementType" AS ENUM ('in', 'out', 'adjustment_in', 'adjustment_out', 'transfer_in', 'transfer_out', 'waste', 'return');
CREATE TYPE "TipSource" AS ENUM ('cash', 'card', 'salon_pool');
CREATE TYPE "StaffPayoutStatus" AS ENUM ('pending', 'paid', 'cancelled');
CREATE TYPE "WaitlistStatus" AS ENUM ('waiting', 'notified', 'booked', 'expired', 'cancelled');
CREATE TYPE "ActivityAction" AS ENUM ('create', 'update', 'delete', 'login', 'logout', 'pay', 'refund', 'cancel', 'status_change', 'message_send');

-- ─── ServicePackage ────────────────────────────────────────────────────────────
CREATE TABLE "service_packages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "serviceId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "totalSessions" INTEGER NOT NULL,
  "price" DECIMAL(10, 2) NOT NULL,
  "validityDays" INTEGER,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_packages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "service_packages_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE NO ACTION
);
CREATE INDEX "service_packages_tenantId_idx" ON "service_packages"("tenantId");
CREATE INDEX "service_packages_serviceId_idx" ON "service_packages"("serviceId");

-- ─── CustomerPackage ───────────────────────────────────────────────────────────
CREATE TABLE "customer_packages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "packageId" UUID NOT NULL,
  "totalSessions" INTEGER NOT NULL,
  "remainingSessions" INTEGER NOT NULL,
  "pricePaid" DECIMAL(10, 2) NOT NULL,
  "status" "PackageStatus" NOT NULL DEFAULT 'active',
  "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_packages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "customer_packages_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE NO ACTION,
  CONSTRAINT "customer_packages_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "service_packages"("id") ON DELETE NO ACTION
);
CREATE INDEX "customer_packages_tenantId_idx" ON "customer_packages"("tenantId");
CREATE INDEX "customer_packages_customerId_status_idx" ON "customer_packages"("customerId", "status");
CREATE INDEX "customer_packages_expiresAt_idx" ON "customer_packages"("expiresAt");

-- ─── PackageUsage ──────────────────────────────────────────────────────────────
CREATE TABLE "package_usages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customerPackageId" UUID NOT NULL,
  "appointmentId" UUID,
  "tenantId" UUID NOT NULL,
  "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  CONSTRAINT "package_usages_customerPackageId_fkey" FOREIGN KEY ("customerPackageId") REFERENCES "customer_packages"("id") ON DELETE CASCADE,
  CONSTRAINT "package_usages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
);
CREATE INDEX "package_usages_customerPackageId_idx" ON "package_usages"("customerPackageId");
CREATE INDEX "package_usages_tenantId_idx" ON "package_usages"("tenantId");
CREATE INDEX "package_usages_appointmentId_idx" ON "package_usages"("appointmentId");

-- ─── TipEntry ──────────────────────────────────────────────────────────────────
CREATE TABLE "tip_entries" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "appointmentId" UUID,
  "staffId" UUID,
  "amount" DECIMAL(10, 2) NOT NULL,
  "source" "TipSource" NOT NULL DEFAULT 'cash',
  "notes" TEXT,
  "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isDistributed" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "tip_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
);
CREATE INDEX "tip_entries_tenantId_idx" ON "tip_entries"("tenantId");
CREATE INDEX "tip_entries_staffId_idx" ON "tip_entries"("staffId");
CREATE INDEX "tip_entries_appointmentId_idx" ON "tip_entries"("appointmentId");

-- ─── TipDistribution ───────────────────────────────────────────────────────────
CREATE TABLE "tip_distributions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "tipEntryId" UUID,
  "staffId" UUID NOT NULL,
  "amount" DECIMAL(10, 2) NOT NULL,
  "shareWeight" DECIMAL(5, 2),
  "notes" TEXT,
  "distributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tip_distributions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "tip_distributions_tipEntryId_fkey" FOREIGN KEY ("tipEntryId") REFERENCES "tip_entries"("id") ON DELETE NO ACTION
);
CREATE INDEX "tip_distributions_tenantId_idx" ON "tip_distributions"("tenantId");
CREATE INDEX "tip_distributions_staffId_idx" ON "tip_distributions"("staffId");

-- ─── CustomerPhoto ─────────────────────────────────────────────────────────────
CREATE TABLE "customer_photos" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "url" TEXT NOT NULL,
  "caption" TEXT,
  "category" TEXT,
  "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_photos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "customer_photos_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE
);
CREATE INDEX "customer_photos_tenantId_idx" ON "customer_photos"("tenantId");
CREATE INDEX "customer_photos_customerId_takenAt_idx" ON "customer_photos"("customerId", "takenAt" DESC);

-- ─── CustomerHairFormula ───────────────────────────────────────────────────────
CREATE TABLE "customer_hair_formulas" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "formula" TEXT NOT NULL,
  "brand" TEXT,
  "processTime" INTEGER,
  "result" TEXT,
  "staffId" UUID,
  CONSTRAINT "customer_hair_formulas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "customer_hair_formulas_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE
);
CREATE INDEX "customer_hair_formulas_tenantId_idx" ON "customer_hair_formulas"("tenantId");
CREATE INDEX "customer_hair_formulas_customerId_date_idx" ON "customer_hair_formulas"("customerId", "date" DESC);

-- ─── StaffPayout ───────────────────────────────────────────────────────────────
CREATE TABLE "staff_payouts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "staffId" UUID NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "grossEarned" DECIMAL(10, 2) NOT NULL,
  "bonus" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "deductions" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "netAmount" DECIMAL(10, 2) NOT NULL,
  "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'cash',
  "status" "StaffPayoutStatus" NOT NULL DEFAULT 'pending',
  "notes" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_payouts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
);
CREATE INDEX "staff_payouts_tenantId_idx" ON "staff_payouts"("tenantId");
CREATE INDEX "staff_payouts_staffId_periodEnd_idx" ON "staff_payouts"("staffId", "periodEnd" DESC);

-- ─── Supplier ──────────────────────────────────────────────────────────────────
CREATE TABLE "suppliers" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "suppliers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
);
CREATE INDEX "suppliers_tenantId_idx" ON "suppliers"("tenantId");

-- ─── StockMovement ─────────────────────────────────────────────────────────────
CREATE TABLE "stock_movements" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "inventoryId" UUID NOT NULL,
  "type" "StockMovementType" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitCost" DECIMAL(10, 2),
  "totalCost" DECIMAL(10, 2),
  "supplierId" UUID,
  "appointmentId" UUID,
  "notes" TEXT,
  "performedBy" UUID,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_movements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "stock_movements_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "inventory"("id") ON DELETE NO ACTION,
  CONSTRAINT "stock_movements_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE NO ACTION
);
CREATE INDEX "stock_movements_tenantId_idx" ON "stock_movements"("tenantId");
CREATE INDEX "stock_movements_inventoryId_occurredAt_idx" ON "stock_movements"("inventoryId", "occurredAt" DESC);
CREATE INDEX "stock_movements_appointmentId_idx" ON "stock_movements"("appointmentId");

-- ─── ServiceInventoryRecipe ────────────────────────────────────────────────────
CREATE TABLE "service_inventory_recipes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "serviceId" UUID NOT NULL,
  "inventoryId" UUID NOT NULL,
  "quantityPerUse" DECIMAL(10, 3) NOT NULL,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_inventory_recipes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "service_inventory_recipes_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE,
  CONSTRAINT "service_inventory_recipes_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "inventory"("id") ON DELETE NO ACTION,
  CONSTRAINT "service_inventory_recipes_serviceId_inventoryId_key" UNIQUE ("serviceId", "inventoryId")
);
CREATE INDEX "service_inventory_recipes_tenantId_idx" ON "service_inventory_recipes"("tenantId");

-- ─── Waitlist ──────────────────────────────────────────────────────────────────
CREATE TABLE "waitlist" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "serviceId" UUID,
  "staffId" UUID,
  "preferredDate" DATE,
  "preferredTimeRange" TEXT,
  "status" "WaitlistStatus" NOT NULL DEFAULT 'waiting',
  "notes" TEXT,
  "notifiedAt" TIMESTAMP(3),
  "bookedAppointmentId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "waitlist_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "waitlist_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE
);
CREATE INDEX "waitlist_tenantId_status_idx" ON "waitlist"("tenantId", "status");
CREATE INDEX "waitlist_preferredDate_idx" ON "waitlist"("preferredDate");

-- ─── ActivityLog ───────────────────────────────────────────────────────────────
CREATE TABLE "activity_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "userId" UUID,
  "action" "ActivityAction" NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "description" TEXT NOT NULL,
  "metadata" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
);
CREATE INDEX "activity_logs_tenantId_createdAt_idx" ON "activity_logs"("tenantId", "createdAt" DESC);
CREATE INDEX "activity_logs_entityType_entityId_idx" ON "activity_logs"("entityType", "entityId");
