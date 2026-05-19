-- Alış Faturası (Purchase Invoice) — Tedarikçi alımları + otomatik stok + cari

CREATE TYPE "PurchaseInvoiceStatus" AS ENUM ('draft', 'posted', 'cancelled');

CREATE TABLE "purchase_invoices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "supplierId" UUID NOT NULL,
  "invoiceNumber" TEXT,
  "invoiceDate" DATE NOT NULL,
  "dueDate" DATE,
  "status" "PurchaseInvoiceStatus" NOT NULL DEFAULT 'draft',
  "subtotal" DECIMAL(12,2) NOT NULL,
  "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(12,2) NOT NULL,
  "notes" TEXT,
  "postedAt" TIMESTAMP(3),
  "createdBy" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "purchase_invoices_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "purchase_invoices_tenantId_invoiceDate_idx" ON "purchase_invoices"("tenantId", "invoiceDate" DESC);
CREATE INDEX "purchase_invoices_supplierId_idx" ON "purchase_invoices"("supplierId");

CREATE TABLE "purchase_invoice_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "invoiceId" UUID NOT NULL,
  "inventoryId" UUID,
  "name" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_invoice_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "purchase_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "purchase_invoice_items_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "purchase_invoice_items_invoiceId_idx" ON "purchase_invoice_items"("invoiceId");
