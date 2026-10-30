-- A3 / ADR-0042: personel daveti. Token yalnız SHA-256 özetiyle saklanır; tek kullanımlık, 7 gün geçerli.
-- Geri alma: DROP TABLE "invitations"; (bekleyen davetler düşer; kabul edilmiş kullanıcılar etkilenmez.)
CREATE TABLE "invitations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "title" TEXT,
  "invitedById" UUID,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "acceptedUserId" UUID,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invitations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invitations_role_not_owner" CHECK ("role" IN ('manager', 'receptionist', 'staff'))
);
CREATE UNIQUE INDEX "invitations_tokenHash_key" ON "invitations"("tokenHash");
CREATE INDEX "invitations_tenantId_createdAt_idx" ON "invitations"("tenantId", "createdAt");
CREATE INDEX "invitations_tenantId_email_idx" ON "invitations"("tenantId", "email");
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
