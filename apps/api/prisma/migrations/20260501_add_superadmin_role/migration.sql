-- Add superadmin value to UserRole enum
ALTER TYPE "UserRole" ADD VALUE 'superadmin';

-- Make tenantId nullable to support superadmin users without a tenant
ALTER TABLE "users" ALTER COLUMN "tenantId" DROP NOT NULL;
