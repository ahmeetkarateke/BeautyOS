-- Banka & Kasa Hesapları + Hareketler

CREATE TYPE "FinancialAccountType" AS ENUM ('cash', 'bank', 'pos', 'credit_card', 'other');

CREATE TYPE "FinancialTransactionType" AS ENUM (
  'income',
  'expense',
  'transfer_in',
  'transfer_out',
  'opening_balance',
  'adjustment'
);

CREATE TABLE "financial_accounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "type" "FinancialAccountType" NOT NULL,
  "name" TEXT NOT NULL,
  "bankName" TEXT,
  "accountHolder" TEXT,
  "iban" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'TRY',
  "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "financial_accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "financial_accounts_tenantId_type_idx" ON "financial_accounts"("tenantId", "type");

CREATE TABLE "financial_transactions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "accountId" UUID NOT NULL,
  "type" "FinancialTransactionType" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT,
  "customerId" UUID,
  "supplierId" UUID,
  "counterpartyAccountId" UUID,
  "referenceType" TEXT,
  "referenceId" UUID,
  "createdBy" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "financial_transactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "financial_transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "financial_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "financial_transactions_counterpartyAccountId_fkey" FOREIGN KEY ("counterpartyAccountId") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "financial_transactions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "financial_transactions_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "financial_transactions_tenantId_date_idx" ON "financial_transactions"("tenantId", "date" DESC);
CREATE INDEX "financial_transactions_accountId_date_idx" ON "financial_transactions"("accountId", "date" DESC);
CREATE INDEX "financial_transactions_customerId_idx" ON "financial_transactions"("customerId");
CREATE INDEX "financial_transactions_supplierId_idx" ON "financial_transactions"("supplierId");
