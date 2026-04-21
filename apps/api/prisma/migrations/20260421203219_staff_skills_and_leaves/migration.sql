-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('percentage', 'fixed');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('day_off', 'sick_leave', 'vacation', 'other');

-- CreateTable
CREATE TABLE "staff_service_assignments" (
    "id" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "commissionType" "CommissionType" NOT NULL DEFAULT 'percentage',
    "commissionValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "priceOverride" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_service_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_leaves" (
    "id" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "leaveDate" DATE NOT NULL,
    "leaveType" "LeaveType" NOT NULL DEFAULT 'day_off',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_leaves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_service_assignments_staffId_idx" ON "staff_service_assignments"("staffId");

-- CreateIndex
CREATE INDEX "staff_service_assignments_serviceId_idx" ON "staff_service_assignments"("serviceId");

-- CreateIndex
CREATE INDEX "staff_service_assignments_tenantId_idx" ON "staff_service_assignments"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_service_assignments_staffId_serviceId_key" ON "staff_service_assignments"("staffId", "serviceId");

-- CreateIndex
CREATE INDEX "staff_leaves_staffId_idx" ON "staff_leaves"("staffId");

-- CreateIndex
CREATE INDEX "staff_leaves_tenantId_leaveDate_idx" ON "staff_leaves"("tenantId", "leaveDate");

-- AddForeignKey
ALTER TABLE "staff_service_assignments" ADD CONSTRAINT "staff_service_assignments_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_service_assignments" ADD CONSTRAINT "staff_service_assignments_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_service_assignments" ADD CONSTRAINT "staff_service_assignments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_leaves" ADD CONSTRAINT "staff_leaves_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_leaves" ADD CONSTRAINT "staff_leaves_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
