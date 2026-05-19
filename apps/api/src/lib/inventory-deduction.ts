import { Prisma } from '@prisma/client'

export interface DeductionEntry {
  inventoryId: string
  inventoryName: string
  decremented: number
  newQuantity: number
  movementId: string
}

export interface DeductionResult {
  appointmentId: string
  serviceId: string
  entries: DeductionEntry[]
  skipped: Array<{ inventoryId: string; reason: string }>
}

/**
 * Apply inventory deduction for an appointment based on the service's recipes.
 * - Reads appointment.serviceId + tenantId
 * - Finds active ServiceInventoryRecipe rows
 * - Decrements InventoryItem.quantity by ceil(quantityPerUse) per recipe
 * - Creates a StockMovement (type=out) per recipe with appointmentId
 *
 * Atomic via the passed Prisma transaction client.
 *
 * Safe to wire later inside an existing appointment status-change transaction:
 *
 *   await db.$transaction(async (tx) => {
 *     await tx.appointment.update({ ... status: 'completed' ... })
 *     await applyInventoryDeduction(tx, appointmentId)
 *   })
 */
export async function applyInventoryDeduction(
  tx: Prisma.TransactionClient,
  appointmentId: string,
  performedBy?: string,
): Promise<DeductionResult> {
  const appointment = await tx.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, tenantId: true, serviceId: true },
  })

  if (!appointment) {
    throw new Error('Randevu bulunamadı.')
  }

  const recipes = await tx.serviceInventoryRecipe.findMany({
    where: {
      tenantId: appointment.tenantId,
      serviceId: appointment.serviceId,
      isActive: true,
    },
    include: {
      inventory: { select: { id: true, name: true, quantity: true, unitCost: true } },
    },
  })

  const entries: DeductionEntry[] = []
  const skipped: Array<{ inventoryId: string; reason: string }> = []

  for (const recipe of recipes) {
    // quantityPerUse is Decimal — ceil to nearest int unit
    const qtyDec = new Prisma.Decimal(recipe.quantityPerUse)
    const qtyInt = qtyDec.greaterThan(0) ? qtyDec.ceil().toNumber() : 0

    if (qtyInt <= 0) {
      skipped.push({ inventoryId: recipe.inventoryId, reason: 'INVALID_QUANTITY' })
      continue
    }

    const updated = await tx.inventoryItem.update({
      where: { id: recipe.inventoryId },
      data: { quantity: { decrement: qtyInt } },
      select: { id: true, name: true, quantity: true, unitCost: true },
    })

    const movement = await tx.stockMovement.create({
      data: {
        tenantId: appointment.tenantId,
        inventoryId: recipe.inventoryId,
        type: 'out',
        quantity: qtyInt,
        unitCost: updated.unitCost,
        totalCost: new Prisma.Decimal(updated.unitCost).mul(qtyInt),
        appointmentId: appointment.id,
        performedBy: performedBy ?? null,
        notes: `Otomatik düşüm — ${recipe.notes ?? 'reçete'}`,
      },
      select: { id: true },
    })

    entries.push({
      inventoryId: updated.id,
      inventoryName: updated.name,
      decremented: qtyInt,
      newQuantity: updated.quantity,
      movementId: movement.id,
    })
  }

  return {
    appointmentId: appointment.id,
    serviceId: appointment.serviceId,
    entries,
    skipped,
  }
}
