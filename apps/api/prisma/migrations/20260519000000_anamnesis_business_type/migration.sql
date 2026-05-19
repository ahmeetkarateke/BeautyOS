-- 20260519: BusinessType enum, Tenant.businessType, Anamnesis (questions + answers), drop CustomerHairFormula

-- Enums
CREATE TYPE "BusinessType" AS ENUM (
  'dentist',
  'aesthetic_clinic',
  'beauty_center',
  'hair_salon',
  'barbershop',
  'spa',
  'nail_studio',
  'massage',
  'tattoo_piercing',
  'hair_transplant',
  'other'
);

CREATE TYPE "AnamnesisQuestionType" AS ENUM (
  'short_text',
  'long_text',
  'yes_no',
  'single_choice',
  'multi_choice',
  'date',
  'number'
);

-- Tenant.businessType
ALTER TABLE "tenants" ADD COLUMN "businessType" "BusinessType" NOT NULL DEFAULT 'beauty_center';

-- AnamnesisQuestion
CREATE TABLE "anamnesis_questions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "label" TEXT NOT NULL,
  "type" "AnamnesisQuestionType" NOT NULL,
  "options" JSONB,
  "helperText" TEXT,
  "isRequired" BOOLEAN NOT NULL DEFAULT false,
  "isCustom" BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "anamnesis_questions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "anamnesis_questions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "anamnesis_questions_tenantId_order_idx" ON "anamnesis_questions"("tenantId", "order");

-- CustomerAnamnesisAnswer
CREATE TABLE "customer_anamnesis_answers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "questionId" UUID NOT NULL,
  "value" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_anamnesis_answers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_anamnesis_answers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "customer_anamnesis_answers_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "customer_anamnesis_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "anamnesis_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "customer_anamnesis_answers_customerId_questionId_key" ON "customer_anamnesis_answers"("customerId", "questionId");
CREATE INDEX "customer_anamnesis_answers_tenantId_idx" ON "customer_anamnesis_answers"("tenantId");
CREATE INDEX "customer_anamnesis_answers_customerId_idx" ON "customer_anamnesis_answers"("customerId");

-- Drop CustomerHairFormula
DROP TABLE IF EXISTS "customer_hair_formulas";
