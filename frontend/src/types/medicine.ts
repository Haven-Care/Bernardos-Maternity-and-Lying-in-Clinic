import type { DateString, DateTimeString, Peso } from './common'

/** Observed in the Medicine List filter dropdown. Free text underneath. */
export type MedicineCategory =
  | 'Analgesic'
  | 'Antibiotic'
  | 'Supplement'
  | 'Antiseptic'
  | (string & {})

/** Observed in the medicine detail modal's Dosage Form select. */
export type DosageForm =
  | 'Tablet'
  | 'Capsule'
  | 'Syrup'
  | 'Injection'
  | 'Ointment'

/** Observed in the stock modals' unit select. */
export type MedicineUnit = 'pcs' | 'Boxes' | 'Bottles' | 'Vials' | (string & {})

export type StockMovementType = 'stock_in' | 'stock_out'

/**
 * A medicine, as defined once in the catalogue.
 *
 * Note what is *not* here: quantity and expiry. A medicine has neither — its
 * batches do. See `MedicineBatch`.
 *
 * Field groups mirror the four sections of the detail modal.
 */
export interface Medicine {
  id: string

  // Basic Medicine Details
  genericName: string
  brandName: string
  category: MedicineCategory
  dosageForm: DosageForm
  dosage: string
  unit: MedicineUnit

  // Inventory & Stock Tracking
  /** Low Stock tab compares total on-hand against this. */
  reorderLevel: number

  // Pricing & Financials
  unitCost: Peso
  sellingPrice: Peso

  // Storage & Supplier Info
  supplierName: string
  supplierContact: string
  storageLocation: string

  active: boolean
}

/**
 * A received lot of one medicine, with its own quantity and expiry.
 *
 * **This is why `Medicine` has no `quantity` field.** The Expiration Tracker tab
 * lists Batch No. and Days Left per row, so one medicine holds several lots
 * expiring on different dates. A flat `quantity: number` cannot express "200
 * units expiring Nov 3, 150 expiring Jan 20" — which is exactly what the clinic
 * needs to see. The old `InventoryItem` type got this wrong; this replaces it.
 */
export interface MedicineBatch {
  id: string
  medicineId: string
  /** e.g. `B-2091`. */
  batchNo: string
  quantity: number
  expiresAt: DateString
  receivedAt: DateString
}

/**
 * One row of the Stock Movement tab — the audit trail.
 *
 * Stock is never adjusted by writing a new quantity; it moves by recording a
 * movement. The log *is* the feature.
 */
export interface StockMovement {
  id: string
  batchId: string
  medicineId: string
  type: StockMovementType
  quantity: number
  /** Record Stock Out captures e.g. "Dispensed to patient". */
  note: string
  occurredAt: DateTimeString
  createdBy: string
}

// ---------------------------------------------------------------------------
// Derived view models — computed from the three types above, never stored.
// ---------------------------------------------------------------------------

export type StockStatus = 'good' | 'low' | 'out'

/** A row of the Medicine List tab. */
export interface MedicineListRow extends Medicine {
  /** Sum of `quantity` across this medicine's batches. */
  qtyOnHand: number
  /** Soonest `expiresAt` across its batches; `null` when it has none. */
  nearestExpiry: DateString | null
  stockStatus: StockStatus
}

/** A row of the Low Stock tab. */
export interface LowStockRow {
  medicineId: string
  genericName: string
  qtyOnHand: number
  reorderLevel: number
  unit: MedicineUnit
}

/** A row of the Expiration Tracker tab. */
export interface ExpiringBatchRow {
  batchId: string
  medicineId: string
  genericName: string
  batchNo: string
  expiresAt: DateString
  /** Negative once expired. The design renders these in red. */
  daysLeft: number
}

/** The four stat tiles above the Inventory tabs. */
export interface InventoryStats {
  totalMedicines: number
  lowStock: number
  expiringSoon: number
  expired: number
}

export interface MedicineInput {
  genericName: string
  brandName: string
  category: MedicineCategory
  dosageForm: DosageForm
  dosage: string
  unit: MedicineUnit
  reorderLevel: number
  unitCost: Peso
  sellingPrice: Peso
  supplierName: string
  supplierContact: string
  storageLocation: string
}

/** Record Stock In — creates or tops up a batch. */
export interface StockInInput {
  medicineId: string
  batchNo: string
  quantity: number
  expiresAt: DateString
  note: string
}

/** Record Stock Out — draws down a specific batch. */
export interface StockOutInput {
  batchId: string
  quantity: number
  note: string
}
