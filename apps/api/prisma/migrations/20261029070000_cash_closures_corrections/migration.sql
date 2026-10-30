-- A6b (R5): kasa gunu kapanisi (yeniden acilabilir) ve duzeltme kaydi.
--  * cash_day_closures: kiracida gun basina tek satir; isClosed=false "yeniden acildi" demektir (satir ve sayim izi kalir).
--  * corrections: tamamlanmis odeme duzeltmesi ve gun yeniden acma; kim, ne zaman, eski -> yeni, gerekce.
-- Geri alma: DROP TABLE "corrections"; DROP TABLE "cash_day_closures"; DROP TYPE "CorrectionKind";
-- (kapanis ve duzeltme gecmisi kaybolur; baska veri etkilenmez.)
CREATE TYPE "CorrectionKind" AS ENUM ('payment', 'day_reopen');

CREATE TABLE "cash_day_closures" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "date" DATE NOT NULL,
  "isClosed" BOOLEAN NOT NULL DEFAULT true,
  "closedById" UUID,
  "closedAt" TIMESTAMP(3),
  "expectedCash" DECIMAL(10,2),
  "countedCash" DECIMAL(10,2),
  "note" TEXT,
  "reopenedById" UUID,
  "reopenedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cash_day_closures_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cash_day_closures_tenantId_date_key" ON "cash_day_closures"("tenantId", "date");
ALTER TABLE "cash_day_closures" ADD CONSTRAINT "cash_day_closures_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "corrections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "kind" "CorrectionKind" NOT NULL,
  "transactionId" UUID,
  "appointmentId" UUID,
  "date" DATE,
  "oldValue" JSONB NOT NULL,
  "newValue" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "corrections_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "corrections_tenantId_createdAt_idx" ON "corrections"("tenantId", "createdAt");
CREATE INDEX "corrections_tenantId_date_idx" ON "corrections"("tenantId", "date");
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
