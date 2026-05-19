-- Cari Hesap (Current Account) — Müşteri & Tedarikçi açık hesap takibi

CREATE TYPE "CurrentAccountPartyType" AS ENUM ('customer', 'supplier');

CREATE TYPE "CurrentAccountEntryRefType" AS ENUM (
  'manual',
  'opening_balance',
  'appointment',
  'invoice',
  'purchase_invoice',
  'payment',
  'refund',
  'adjustment'
);

CREATE TABLE "current_account_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "partyType" "CurrentAccountPartyType" NOT NULL,
  "customerId" UUID,
  "supplierId" UUID,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "debit" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "credit" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "description" TEXT NOT NULL,
  "referenceType" "CurrentAccountEntryRefType" NOT NULL DEFAULT 'manual',
  "referenceId" UUID,
  "createdBy" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "current_account_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "current_account_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "current_account_entries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "current_account_entries_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "current_account_entries_tenantId_partyType_idx" ON "current_account_entries"("tenantId", "partyType");
CREATE INDEX "current_account_entries_customerId_date_idx" ON "current_account_entries"("customerId", "date" DESC);
CREATE INDEX "current_account_entries_supplierId_date_idx" ON "current_account_entries"("supplierId", "date" DESC);
