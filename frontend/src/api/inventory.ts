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
import { datedList } from './pagination'
import { apiFetch } from './client'
import { medicinePhotoError } from '../lib/medicinePhoto'

export async function getMedicinePhoto(id: string): Promise<{ url: string | null }> {
  return apiFetch(`/inventory/medicines/${id}/photo`)
}

export async function uploadMedicinePhoto(id: string, file: File): Promise<void> {
  const invalid = medicinePhotoError(file)
  if (invalid) throw new Error(invalid)
  const signed = await apiFetch<{ path: string; signedUrl: string }>(`/inventory/medicines/${id}/photo/upload-url`, {
    method: 'POST', body: JSON.stringify({ contentType: file.type }),
  })
  const upload = await fetch(signed.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
  if (!upload.ok) throw new Error('The photo could not be uploaded. Please try again.')
  await apiFetch(`/inventory/medicines/${id}/photo`, { method: 'PUT', body: JSON.stringify({ storagePath: signed.path }) })
}

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

export async function listMedicines(includeArchived = false): Promise<MedicineListRow[]> {
  return apiFetch<MedicineListRow[]>(`/inventory/medicines${includeArchived ? '?includeArchived=true' : ''}`)
}

export async function getMedicine(id: string): Promise<MedicineListRow> {
  return apiFetch<MedicineListRow>(`/inventory/medicines/${id}`)
}

export async function listBatches(medicineId: string): Promise<MedicineBatch[]> {
  return datedList<MedicineBatch>(`/inventory/medicines/${medicineId}/batches`)
}

export async function listMovements(dates?: { from: string; to: string }, batchId?: string): Promise<StockMovement[]> {
  return datedList<StockMovement>(`/inventory/movements${batchId ? `?batchId=${encodeURIComponent(batchId)}` : ''}`, dates)
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

export function listAllBatches(medicineId?: string): Promise<import('../types/medicine').BatchListRow[]> {
  return datedList(`/inventory/batches${medicineId ? `?medicineId=${encodeURIComponent(medicineId)}` : ''}`)
}
export function listBatchEvents(id: string): Promise<import('../types/medicine').BatchEvent[]> {
  return datedList(`/inventory/batches/${id}/events`)
}
export function receiveStock(input: import('../types/medicine').ReceiveStockInput): Promise<MedicineBatch> {
  return apiFetch('/inventory/receipts', { method: 'POST', body: JSON.stringify(input) })
}
export function moveStock(id: string, input: { quantity: number; reason: 'dispensed' | 'disposed' | 'adjustment'; note: string }): Promise<MedicineBatch> {
  return apiFetch(`/inventory/batches/${id}/move`, { method: 'POST', body: JSON.stringify(input) })
}
export function quarantineBatch(id: string, quarantined: boolean, note: string): Promise<MedicineBatch> {
  return apiFetch(`/inventory/batches/${id}/quarantine`, { method: 'POST', body: JSON.stringify({ quarantined, note }) })
}
export function reverseMovement(id: string, note: string): Promise<MedicineBatch> {
  return apiFetch(`/inventory/movements/${id}/reverse`, { method: 'POST', body: JSON.stringify({ note }) })
}
export function archiveMedicine(id: string, archive: boolean): Promise<MedicineListRow> {
  return apiFetch(`/inventory/medicines/${id}/archive`, { method: 'PATCH', body: JSON.stringify({ archive }) })
}
