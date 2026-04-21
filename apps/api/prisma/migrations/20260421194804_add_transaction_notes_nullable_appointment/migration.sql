-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_appointmentId_fkey";

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "notes" TEXT,
ALTER COLUMN "appointmentId" DROP NOT NULL,
ALTER COLUMN "staffId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
