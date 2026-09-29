import type { Database } from '../db/types.js'
import type {
  ExpiringBatchRow,
  MedicineBatch,
  MedicineListRow,
  StockMovement,
} from '../contract/medicine.js'

type StockViewRow = Database['public']['Views']['medicine_stock']['Row']
type BatchRow = Database['public']['Tables']['medicine_batches']['Row']
type MovementRow = Database['public']['Tables']['stock_movements']['Row']

/**
 * A row of the Medicine List tab.
 *
 * Comes from the `medicine_stock` view, so `qtyOnHand`, `nearestExpiry` and
 * `stockStatus` are computed in SQL rather than assembled here — the same
 * numbers the Low Stock tab and the stat tiles read, from the same place.
 *
 * Every view column is nullable in the generated types, because Postgres cannot
 * promise otherwise. The non-null ones are asserted at this single boundary.
 */
export function toMedicineListRow(row: StockViewRow): MedicineListRow {
  return {
    id: row.id!,
    genericName: row.generic_name!,
    brandName: row.brand_name!,
    category: row.category!,
    dosageForm: row.dosage_form!,
    dosage: row.dosage!,
    unit: row.unit!,
    reorderLevel: row.reorder_level!,
    unitCost: Number(row.unit_cost),
    sellingPrice: Number(row.selling_price),
    supplierName: row.supplier_name!,
    supplierContact: row.supplier_contact!,
    storageLocation: row.storage_location!,
    active: row.active!,

    qtyOnHand: Number(row.qty_on_hand ?? 0),
    nearestExpiry: row.nearest_expiry,
    stockStatus: row.stock_status!,
  }
}

export function toBatch(row: BatchRow): MedicineBatch {
  return {
    id: row.id,
    medicineId: row.medicine_id,
    batchNo: row.batch_no,
    quantity: row.quantity,
    expiresAt: row.expires_at,
    receivedAt: row.received_at,
  }
}

export function toMovement(
  row: MovementRow,
  createdBy: string,
): StockMovement {
  return {
    id: row.id,
    batchId: row.batch_id,
    medicineId: row.medicine_id,
    type: row.type,
    quantity: row.quantity,
    note: row.note,
    occurredAt: row.occurred_at,
    // The contract carries a name — the log reads "Hannah Puerta", not a uuid.
    // Null once a staff member is removed, which the log has to survive.
    createdBy,
  }
}

/** A row of the Expiration Tracker tab. Negative days mean already expired. */
export function toExpiringRow(
  row: BatchRow & { medicines: { generic_name: string } | null },
  today: string,
): ExpiringBatchRow {
  return {
    batchId: row.id,
    medicineId: row.medicine_id,
    genericName: row.medicines?.generic_name ?? 'Unknown',
    batchNo: row.batch_no,
    expiresAt: row.expires_at,
    daysLeft: daysBetween(today, row.expires_at),
  }
}

/**
 * Whole days from `from` to `to`.
 *
 * Both are 'YYYY-MM-DD' calendar dates, so this counts days rather than
 * subtracting instants — using Date arithmetic on local times would land a day
 * out across a DST boundary, and "expires in 0 days" versus "expired yesterday"
 * is a distinction the Expiration Tracker colours red.
 */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(
    Number(from.slice(0, 4)),
    Number(from.slice(5, 7)) - 1,
    Number(from.slice(8, 10)),
  )
  const b = Date.UTC(
    Number(to.slice(0, 4)),
    Number(to.slice(5, 7)) - 1,
    Number(to.slice(8, 10)),
  )

  return Math.round((b - a) / 86_400_000)
}
