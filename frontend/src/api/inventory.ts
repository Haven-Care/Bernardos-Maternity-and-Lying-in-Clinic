import type {
  ExpiringBatchRow,
  InventoryStats,
  LowStockRow,
  MedicineBatch,
  MedicineInput,
  MedicineListRow,
  StockInInput,
  StockMovement,
  StockOutInput,
} from '../types/medicine'
import { apiFetch } from './client'

/**
 * Inventory.
 *
 * The derivation that used to live at the top of this file — qtyOnHand,
 * nearestExpiry, stockStatus, low stock, days left — is now SQL. It was written
 * here rather than in components precisely so this swap could delete it
 * wholesale; the screens never learn it moved.
 *
 * `qtyOnHand` is a sum over batches, and `stockStatus` compares it to the
 * reorder level, both from the `medicine_stock` view. Every tab and the stat
 * tiles read the same definition, so Low Stock and the Dashboard alert count
 * cannot disagree.
 */

// --- Reads ------------------------------------------------------------------

export async function listMedicines(): Promise<MedicineListRow[]> {
  return apiFetch<MedicineListRow[]>('/inventory/medicines')
}

export async function getMedicine(id: string): Promise<MedicineListRow> {
  return apiFetch<MedicineListRow>(`/inventory/medicines/${id}`)
}

export async function listBatches(medicineId: string): Promise<MedicineBatch[]> {
  return apiFetch<MedicineBatch[]>(`/inventory/medicines/${medicineId}/batches`)
}

export async function listMovements(): Promise<StockMovement[]> {
  return apiFetch<StockMovement[]>('/inventory/movements')
}

export async function listLowStock(): Promise<LowStockRow[]> {
  return apiFetch<LowStockRow[]>('/inventory/low-stock')
}

/** Batches inside the near-expiry window, plus anything already expired. */
export async function listExpiring(): Promise<ExpiringBatchRow[]> {
  return apiFetch<ExpiringBatchRow[]>('/inventory/expiring')
}

export async function getInventoryStats(): Promise<InventoryStats> {
  return apiFetch<InventoryStats>('/inventory/stats')
}

// --- Writes -----------------------------------------------------------------

export async function createMedicine(
  input: MedicineInput,
): Promise<MedicineListRow> {
  return apiFetch<MedicineListRow>('/inventory/medicines', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateMedicine(
  id: string,
  input: MedicineInput,
): Promise<MedicineListRow> {
  return apiFetch<MedicineListRow>(`/inventory/medicines/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

/**
 * Receive stock.
 *
 * Tops up the batch if `batchNo` already exists for this medicine, otherwise
 * opens a new one — two deliveries of the same manufactured lot are one lot,
 * and two rows would both show up in the Expiration Tracker.
 */
export async function recordStockIn(
  input: StockInInput,
): Promise<MedicineBatch> {
  return apiFetch<MedicineBatch>('/inventory/stock-in', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/**
 * Draw down a batch.
 *
 * Quantity is never written directly — it moves by recording a movement,
 * because the Stock Movement log is the feature. Over-drawing comes back as a
 * 409 naming how much is actually left, and the database locks the row first so
 * two simultaneous dispensals cannot both pass the check.
 */
export async function recordStockOut(
  input: StockOutInput,
): Promise<MedicineBatch> {
  return apiFetch<MedicineBatch>('/inventory/stock-out', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
