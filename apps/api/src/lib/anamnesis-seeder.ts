import { BusinessType } from '@prisma/client'
import { db } from './db'
import { DEFAULT_ANAMNESIS_QUESTIONS } from './anamnesis-defaults'

/**
 * Tenant için default anamnez sorularını seed eder.
 * Tenant'ta zaten soru varsa hiçbir şey yapmaz (idempotent).
 */
export async function seedDefaultAnamnesisQuestions(
  tenantId: string,
  businessType: BusinessType,
): Promise<number> {
  const existing = await db.anamnesisQuestion.count({ where: { tenantId } })
  if (existing > 0) return 0

  const defaults = DEFAULT_ANAMNESIS_QUESTIONS[businessType] ?? DEFAULT_ANAMNESIS_QUESTIONS.other

  await db.anamnesisQuestion.createMany({
    data: defaults.map((q, idx) => ({
      tenantId,
      label: q.label,
      type: q.type,
      options: q.options ? q.options : undefined,
      helperText: q.helperText ?? null,
      isRequired: q.isRequired ?? false,
      isCustom: false,
      order: idx,
    })),
  })

  return defaults.length
}
