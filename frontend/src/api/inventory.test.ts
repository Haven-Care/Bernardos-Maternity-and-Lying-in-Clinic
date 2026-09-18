import { describe, expect, it } from 'vitest'
import * as inventory from './inventory'
import { batches, medicines } from '../mocks/medicines'
import { clinicSettings } from '../mocks/clinic'
import { daysUntil } from '../mocks/util'

/**
 * These cover the derivation logic, not the fixtures.
 *
 * Qty on Hand, Low Stock, and Days Left are the three computations the backend
 * will later do in SQL, and they are the ones most likely to be quietly wrong —
 * a flat `quantity` field would pass a typecheck and still produce nonsense in
 * the Expiration Tracker. Asserting them here means the SQL has a spec to match.
 */

describe('qty on hand', () => {
  it('sums across every batch of a medicine', async () => {
    // Paracetamol holds two lots: 120 expiring soon, 580 healthy.
    const rows = await inventory.listMedicines()
    const paracetamol = rows.find((r) => r.genericName === 'Paracetamol')

    expect(paracetamol?.qtyOnHand).toBe(700)
  })

  it('reports the soonest expiry across batches, not an arbitrary one', async () => {
    const rows = await inventory.listMedicines()
    const paracetamol = rows.find((r) => r.genericName === 'Paracetamol')

    const own = batches
      .filter((b) => b.medicineId === paracetamol?.id)
      .map((b) => b.expiresAt)
      .sort()

    expect(paracetamol?.nearestExpiry).toBe(own[0])
  })
})

describe('low stock', () => {
  it('flags only medicines below their own reorder level', async () => {
    const rows = await inventory.listLowStock()

    for (const row of rows) {
      expect(row.qtyOnHand).toBeLessThan(row.reorderLevel)
    }
  })

  it('uses a per-medicine threshold, not a global one', async () => {
    const rows = await inventory.listLowStock()
    const names = rows.map((r) => r.genericName)

    // 20 on hand against a reorder level of 70.
    expect(names).toContain('Ferrous Sulfate')
    // 12 on hand against a reorder level of 30.
    expect(names).toContain('Oxytocin')
    // 700 on hand — healthy, despite a high reorder level of 150.
    expect(names).not.toContain('Folic Acid')
  })
})

describe('expiring batches', () => {
  it('returns batch-level rows, so one medicine can appear per lot', async () => {
    const rows = await inventory.listExpiring()

    for (const row of rows) {
      expect(row.batchNo).toBeTruthy()
      expect(row.daysLeft).toBeLessThanOrEqual(clinicSettings.nearExpiryDays)
    }
  })

  it('sorts soonest-first', async () => {
    const rows = await inventory.listExpiring()
    const days = rows.map((r) => r.daysLeft)

    expect(days).toEqual([...days].sort((a, b) => a - b))
  })

  it('computes days left relative to today, not a fixed date', async () => {
    const rows = await inventory.listExpiring()

    for (const row of rows) {
      expect(row.daysLeft).toBe(daysUntil(row.expiresAt))
    }
  })
})

describe('stock movements', () => {
  it('stock out decrements the batch and appends to the audit log', async () => {
    const batch = batches.find((b) => b.batchNo === 'B-2210')!
    const before = batch.quantity
    const logBefore = (await inventory.listMovements()).length

    await inventory.recordStockOut({
      batchId: batch.id,
      quantity: 10,
      note: 'Dispensed to patient',
    })

    expect(batch.quantity).toBe(before - 10)
    expect((await inventory.listMovements()).length).toBe(logBefore + 1)
  })

  it('moves a medicine into Low Stock when dispensing crosses its reorder level', async () => {
    const medicine = medicines.find((m) => m.genericName === 'Amoxicillin')!
    const batch = batches.find((b) => b.medicineId === medicine.id)!

    const before = await inventory.listMedicines()
    expect(
      before.find((r) => r.id === medicine.id)?.stockStatus,
      'fixture should start healthy for this to mean anything',
    ).toBe('good')

    // Drop it just under the threshold, not to zero — 'low' and 'out' are
    // different states and this asserts the boundary, not the extreme.
    const target = medicine.reorderLevel - 10
    await inventory.recordStockOut({
      batchId: batch.id,
      quantity: batch.quantity - target,
      note: 'Dispensed to patient',
    })

    const after = await inventory.listMedicines()
    const row = after.find((r) => r.id === medicine.id)!

    expect(row.qtyOnHand).toBe(target)
    expect(row.stockStatus).toBe('low')

    const lowStock = await inventory.listLowStock()
    expect(lowStock.map((r) => r.genericName)).toContain('Amoxicillin')

    const stats = await inventory.getInventoryStats()
    expect(stats.lowStock).toBeGreaterThanOrEqual(3)
  })

  it('refuses to dispense more than the batch holds', async () => {
    const batch = batches.find((b) => b.batchNo === 'B-1720')!

    await expect(
      inventory.recordStockOut({
        batchId: batch.id,
        quantity: batch.quantity + 1,
        note: 'Over-dispense',
      }),
    ).rejects.toThrow(/Cannot dispense/)
  })

  it('tops up an existing lot rather than opening a duplicate', async () => {
    const medicine = medicines.find((m) => m.genericName === 'Folic Acid')!
    const existing = batches.find(
      (b) => b.medicineId === medicine.id && b.batchNo === 'B-2044',
    )!
    const countBefore = batches.filter((b) => b.medicineId === medicine.id).length
    const qtyBefore = existing.quantity

    await inventory.recordStockIn({
      medicineId: medicine.id,
      batchNo: 'B-2044',
      quantity: 100,
      expiresAt: existing.expiresAt,
      note: 'Second delivery, same lot',
    })

    expect(existing.quantity).toBe(qtyBefore + 100)
    expect(batches.filter((b) => b.medicineId === medicine.id).length).toBe(
      countBefore,
    )
  })
})
