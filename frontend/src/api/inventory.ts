import type {
  ExpiringBatchRow,
  InventoryStats,
  LowStockRow,
  Medicine,
  MedicineBatch,
  MedicineInput,
  MedicineListRow,
  StockInInput,
  StockMovement,
  StockOutInput,
  StockStatus,
} from '../types/medicine'
import { batches, medicines, movements } from '../mocks/medicines'
import { clinicSettings } from '../mocks/clinic'
import { daysUntil, isoDate, mockDelay, mockReject, uid } from '../mocks/util'
// import { apiFetch } from './client'

// ---------------------------------------------------------------------------
// Derivation
//
// These are the computations the backend will eventually do in SQL. They live
// here rather than in components so the swap replaces them wholesale — a
// component that computed its own Qty on Hand would have to be rewritten.
// ---------------------------------------------------------------------------

function batchesFor(medicineId: string): MedicineBatch[] {
  return batches.filter((b) => b.medicineId === medicineId)
}

function qtyOnHand(medicineId: string): number {
  return batchesFor(medicineId).reduce((sum, b) => sum + b.quantity, 0)
}

function stockStatus(qty: number, reorderLevel: number): StockStatus {
  if (qty <= 0) return 'out'
  return qty < reorderLevel ? 'low' : 'good'
}

function nearestExpiry(medicineId: string): string | null {
  const dates = batchesFor(medicineId)
    .filter((b) => b.quantity > 0)
    .map((b) => b.expiresAt)
    .sort()
  return dates[0] ?? null
}

function toListRow(m: Medicine): MedicineListRow {
  const qty = qtyOnHand(m.id)
  return {
    ...m,
    qtyOnHand: qty,
    nearestExpiry: nearestExpiry(m.id),
    stockStatus: stockStatus(qty, m.reorderLevel),
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listMedicines(): Promise<MedicineListRow[]> {
  // BACKEND: return apiFetch<MedicineListRow[]>('/inventory/medicines')
  return mockDelay(medicines.filter((m) => m.active).map(toListRow))
}

export async function getMedicine(id: string): Promise<MedicineListRow> {
  // BACKEND: return apiFetch<MedicineListRow>(`/inventory/medicines/${id}`)
  const m = medicines.find((x) => x.id === id)
  if (!m) return mockReject(`Medicine not found: ${id}`)
  return mockDelay(toListRow(m))
}

export async function listBatches(medicineId: string): Promise<MedicineBatch[]> {
  // BACKEND: return apiFetch<MedicineBatch[]>(`/inventory/medicines/${medicineId}/batches`)
  return mockDelay(batchesFor(medicineId))
}

export async function listMovements(): Promise<StockMovement[]> {
  // BACKEND: return apiFetch<StockMovement[]>('/inventory/movements')
  const sorted = [...movements].sort((a, b) =>
    b.occurredAt.localeCompare(a.occurredAt),
  )
  return mockDelay(sorted)
}

export async function listLowStock(): Promise<LowStockRow[]> {
  // BACKEND: return apiFetch<LowStockRow[]>('/inventory/low-stock')
  const rows = medicines
    .filter((m) => m.active)
    .map((m) => ({
      medicineId: m.id,
      genericName: m.genericName,
      qtyOnHand: qtyOnHand(m.id),
      reorderLevel: m.reorderLevel,
      unit: m.unit,
    }))
    .filter((r) => r.qtyOnHand < r.reorderLevel)
  return mockDelay(rows)
}

/** Batches expiring within `nearExpiryDays`, plus anything already expired. */
export async function listExpiring(): Promise<ExpiringBatchRow[]> {
  // BACKEND: return apiFetch<ExpiringBatchRow[]>('/inventory/expiring')
  const rows = batches
    .filter((b) => b.quantity > 0)
    .map((b) => {
      const medicine = medicines.find((m) => m.id === b.medicineId)
      return {
        batchId: b.id,
        medicineId: b.medicineId,
        genericName: medicine?.genericName ?? 'Unknown',
        batchNo: b.batchNo,
        expiresAt: b.expiresAt,
        daysLeft: daysUntil(b.expiresAt),
      }
    })
    .filter((r) => r.daysLeft <= clinicSettings.nearExpiryDays)
    .sort((a, b) => a.daysLeft - b.daysLeft)
  return mockDelay(rows)
}

export async function getInventoryStats(): Promise<InventoryStats> {
  // BACKEND: return apiFetch<InventoryStats>('/inventory/stats')
  const active = medicines.filter((m) => m.active)
  const live = batches.filter((b) => b.quantity > 0)

  return mockDelay({
    totalMedicines: active.length,
    lowStock: active.filter((m) => qtyOnHand(m.id) < m.reorderLevel).length,
    expiringSoon: live.filter((b) => {
      const d = daysUntil(b.expiresAt)
      return d >= 0 && d <= clinicSettings.nearExpiryDays
    }).length,
    expired: live.filter((b) => daysUntil(b.expiresAt) < 0).length,
  })
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createMedicine(
  input: MedicineInput,
): Promise<MedicineListRow> {
  // BACKEND: return apiFetch<MedicineListRow>('/inventory/medicines', { method: 'POST', body: JSON.stringify(input) })
  const created: Medicine = { ...input, id: uid('med'), active: true }
  medicines.push(created)
  return mockDelay(toListRow(created))
}

export async function updateMedicine(
  id: string,
  input: MedicineInput,
): Promise<MedicineListRow> {
  // BACKEND: return apiFetch<MedicineListRow>(`/inventory/medicines/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  const m = medicines.find((x) => x.id === id)
  if (!m) return mockReject(`Medicine not found: ${id}`)
  Object.assign(m, input)
  return mockDelay(toListRow(m))
}

/**
 * Receive stock. Tops up the batch if `batchNo` already exists for this
 * medicine, otherwise opens a new one — two deliveries of the same lot should
 * not produce two rows in the Expiration Tracker.
 */
export async function recordStockIn(
  input: StockInInput,
): Promise<MedicineBatch> {
  // BACKEND: return apiFetch<MedicineBatch>('/inventory/stock-in', { method: 'POST', body: JSON.stringify(input) })
  let batch = batches.find(
    (b) => b.medicineId === input.medicineId && b.batchNo === input.batchNo,
  )

  if (batch) {
    batch.quantity += input.quantity
  } else {
    batch = {
      id: uid('batch'),
      medicineId: input.medicineId,
      batchNo: input.batchNo,
      quantity: input.quantity,
      expiresAt: input.expiresAt,
      receivedAt: isoDate(new Date()),
    }
    batches.push(batch)
  }

  movements.push({
    id: uid('mov'),
    batchId: batch.id,
    medicineId: input.medicineId,
    type: 'stock_in',
    quantity: input.quantity,
    note: input.note,
    occurredAt: new Date().toISOString(),
    createdBy: 'Hannah Puerta',
  })

  return mockDelay(batch)
}

/**
 * Draw down a batch. Quantity is never written directly — it moves by recording
 * a movement, because the Stock Movement log is the audit trail the clinic
 * actually asked for.
 */
export async function recordStockOut(
  input: StockOutInput,
): Promise<MedicineBatch> {
  // BACKEND: return apiFetch<MedicineBatch>('/inventory/stock-out', { method: 'POST', body: JSON.stringify(input) })
  const batch = batches.find((b) => b.id === input.batchId)
  if (!batch) return mockReject(`Batch not found: ${input.batchId}`)
  if (input.quantity > batch.quantity) {
    return mockReject(
      `Cannot dispense ${input.quantity} — batch ${batch.batchNo} has ${batch.quantity}`,
    )
  }

  batch.quantity -= input.quantity

  movements.push({
    id: uid('mov'),
    batchId: batch.id,
    medicineId: batch.medicineId,
    type: 'stock_out',
    quantity: input.quantity,
    note: input.note,
    occurredAt: new Date().toISOString(),
    createdBy: 'Hannah Puerta',
  })

  return mockDelay(batch)
}
