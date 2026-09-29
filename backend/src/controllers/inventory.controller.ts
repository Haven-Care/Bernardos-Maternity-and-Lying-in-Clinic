import type { Request, Response } from 'express'
import { z } from 'zod'
import { getSupabaseClient } from '../config/supabase.js'
import { dbError, unwrap, unwrapList } from '../lib/db.js'
import { parseBody } from '../lib/validate.js'
import { HttpError } from '../middleware/errorHandler.js'
import {
  daysBetween,
  toBatch,
  toExpiringRow,
  toMedicineListRow,
  toMovement,
} from '../mappers/inventory.js'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const idSchema = z.string().uuid('Not a valid id.')

const medicineSchema = z.object({
  genericName: z.string().trim().min(1, 'Generic name is required.'),
  brandName: z.string().trim().default(''),
  // Free text, not an enum: the four observed values are the filter's options,
  // and the seed already needs "Obstetric" for Oxytocin.
  category: z.string().trim().default(''),
  dosageForm: z.enum(['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment']),
  dosage: z.string().trim().default(''),
  unit: z.string().trim().default('pcs'),
  reorderLevel: z.number().int().min(0).default(0),
  unitCost: z.number().min(0).default(0),
  sellingPrice: z.number().min(0).default(0),
  supplierName: z.string().trim().default(''),
  supplierContact: z.string().trim().default(''),
  storageLocation: z.string().trim().default(''),
})

function toRow(input: z.infer<typeof medicineSchema>) {
  return {
    generic_name: input.genericName,
    brand_name: input.brandName,
    category: input.category,
    dosage_form: input.dosageForm,
    dosage: input.dosage,
    unit: input.unit,
    reorder_level: input.reorderLevel,
    unit_cost: input.unitCost,
    selling_price: input.sellingPrice,
    supplier_name: input.supplierName,
    supplier_contact: input.supplierContact,
    storage_location: input.storageLocation,
  }
}

/** The clinic's "today", not the server's — see clinic_today() in the schema. */
async function clinicToday(): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc('clinic_today')
  if (error) throw dbError(error)
  return data
}

/**
 * The acting staff member.
 *
 * Required rather than optional: every stock movement records who made it, and
 * the audit trail is the point of the log. requireStaff guarantees this is set,
 * so reaching the throw means a route was mounted without its guard.
 */
function actor(req: Request): string {
  if (!req.staff) throw new HttpError(500, 'Inventory write without requireStaff')
  return req.staff.userId
}

async function nearExpiryDays(): Promise<number> {
  const { data } = await getSupabaseClient()
    .from('clinic_settings')
    .select('near_expiry_days')
    .eq('id', 1)
    .maybeSingle()

  return data?.near_expiry_days ?? 30
}

// ---------------------------------------------------------------------------
// Reads — all derived values come from the medicine_stock view, never from
// arithmetic done here. One definition of "on hand", shared by every tab.
// ---------------------------------------------------------------------------

export async function listMedicines(_req: Request, res: Response) {
  const rows = unwrapList(
    await getSupabaseClient()
      .from('medicine_stock')
      .select('*')
      .eq('active', true)
      .order('generic_name'),
  )

  res.json(rows.map(toMedicineListRow))
}

export async function getMedicine(req: Request, res: Response) {
  const id = parseBody(idSchema, req.params.id)

  const row = unwrap(
    await getSupabaseClient()
      .from('medicine_stock')
      .select('*')
      .eq('id', id)
      .maybeSingle(),
    'No such medicine.',
  )

  res.json(toMedicineListRow(row))
}

export async function listBatches(req: Request, res: Response) {
  const medicineId = parseBody(idSchema, req.params.id)

  const rows = unwrapList(
    await getSupabaseClient()
      .from('medicine_batches')
      .select('*')
      .eq('medicine_id', medicineId)
      .order('expires_at'),
  )

  res.json(rows.map(toBatch))
}

export async function listMovements(_req: Request, res: Response) {
  const rows = unwrapList(
    await getSupabaseClient()
      .from('stock_movements')
      .select('*, profiles(full_name)')
      .order('occurred_at', { ascending: false })
      .limit(500),
  )

  res.json(
    rows.map((row) => toMovement(row, row.profiles?.full_name ?? 'System')),
  )
}

export async function listLowStock(_req: Request, res: Response) {
  const rows = unwrapList(
    await getSupabaseClient()
      .from('medicine_stock')
      .select('*')
      .eq('active', true)
      .order('generic_name'),
  )

  res.json(
    rows
      .map(toMedicineListRow)
      .filter((m) => m.qtyOnHand < m.reorderLevel)
      .map((m) => ({
        medicineId: m.id,
        genericName: m.genericName,
        qtyOnHand: m.qtyOnHand,
        reorderLevel: m.reorderLevel,
        unit: m.unit,
      })),
  )
}

/**
 * GET /api/inventory/expiring
 *
 * Batches inside the near-expiry window, plus anything already expired.
 *
 * Empty batches are excluded: a lot that ran out three months ago is not
 * something the clinic needs warning about, and leaving them in would bury the
 * real warnings.
 */
export async function listExpiring(_req: Request, res: Response) {
  const [today, window] = await Promise.all([clinicToday(), nearExpiryDays()])

  const cutoff = new Date(`${today}T00:00:00Z`)
  cutoff.setUTCDate(cutoff.getUTCDate() + window)
  const cutoffDate = cutoff.toISOString().slice(0, 10)

  const rows = unwrapList(
    await getSupabaseClient()
      .from('medicine_batches')
      .select('*, medicines(generic_name)')
      .gt('quantity', 0)
      .lte('expires_at', cutoffDate)
      .order('expires_at'),
  )

  res.json(rows.map((row) => toExpiringRow(row, today)))
}

export async function getInventoryStats(_req: Request, res: Response) {
  const db = getSupabaseClient()
  const [today, window] = await Promise.all([clinicToday(), nearExpiryDays()])

  const medicines = unwrapList(
    await db.from('medicine_stock').select('*').eq('active', true),
  ).map(toMedicineListRow)

  const batches = unwrapList(
    await db.from('medicine_batches').select('expires_at').gt('quantity', 0),
  )

  const days = batches.map((b) => daysBetween(today, b.expires_at))

  res.json({
    totalMedicines: medicines.length,
    lowStock: medicines.filter((m) => m.qtyOnHand < m.reorderLevel).length,
    expiringSoon: days.filter((d) => d >= 0 && d <= window).length,
    expired: days.filter((d) => d < 0).length,
  })
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createMedicine(req: Request, res: Response) {
  const input = parseBody(medicineSchema, req.body)

  const row = unwrap(
    await getSupabaseClient()
      .from('medicines')
      .insert(toRow(input))
      .select('id')
      .single(),
  )

  // Read back through the view, so the response carries the derived fields the
  // Medicine List renders. A new medicine has no batches, so it comes back
  // qtyOnHand 0 and stockStatus 'out' — which is true, and the list should say
  // so rather than showing a blank.
  const created = unwrap(
    await getSupabaseClient()
      .from('medicine_stock')
      .select('*')
      .eq('id', row.id)
      .single(),
  )

  res.status(201).json(toMedicineListRow(created))
}

export async function updateMedicine(req: Request, res: Response) {
  const id = parseBody(idSchema, req.params.id)
  const input = parseBody(medicineSchema, req.body)

  const updated = unwrap(
    await getSupabaseClient()
      .from('medicines')
      .update(toRow(input))
      .eq('id', id)
      .select('id')
      .maybeSingle(),
    'No such medicine.',
  )

  const row = unwrap(
    await getSupabaseClient()
      .from('medicine_stock')
      .select('*')
      .eq('id', updated.id)
      .single(),
  )

  res.json(toMedicineListRow(row))
}

const stockInSchema = z.object({
  medicineId: z.string().uuid('Choose a medicine.'),
  batchNo: z.string().trim().min(1, 'A batch or lot number is required.'),
  quantity: z.number().int().positive('Quantity must be at least 1.'),
  expiresAt: z.string().regex(DATE, 'Enter an expiry date.'),
  note: z.string().trim().default(''),
})

const stockOutSchema = z.object({
  batchId: z.string().uuid('Choose a batch.'),
  quantity: z.number().int().positive('Quantity must be at least 1.'),
  note: z.string().trim().default(''),
})

/**
 * POST /api/inventory/stock-in
 *
 * Goes through the `record_stock_in` function rather than an insert here,
 * because creating-or-topping-up the batch and appending the movement must be
 * one transaction. supabase-js has no transaction API, so that has to live in
 * the database.
 *
 * A repeat of the same batch number tops up the existing lot instead of opening
 * a second one — two deliveries of one manufactured lot are one lot, and two
 * rows would both appear in the Expiration Tracker.
 */
export async function recordStockIn(req: Request, res: Response) {
  const input = parseBody(stockInSchema, req.body)

  const { data, error } = await getSupabaseClient().rpc('record_stock_in', {
    p_medicine_id: input.medicineId,
    p_batch_no: input.batchNo,
    p_quantity: input.quantity,
    p_expires_at: input.expiresAt,
    p_note: input.note,
    p_actor: actor(req),
  })

  if (error) throw dbError(error)
  if (!data) throw new HttpError(500, 'Stock-in returned nothing.')

  res.status(201).json(toBatch(data))
}

/**
 * POST /api/inventory/stock-out
 *
 * Quantity is never written directly anywhere in this system — it moves only by
 * recording a movement, which is what separates medicine *used* from medicine
 * *wasted* and makes the log worth keeping.
 *
 * The function locks the batch row before reading it, so two dispensals cannot
 * both see enough stock and both succeed. An over-draw comes back as HC409 with
 * the remaining quantity named.
 */
export async function recordStockOut(req: Request, res: Response) {
  const input = parseBody(stockOutSchema, req.body)

  const { data, error } = await getSupabaseClient().rpc('record_stock_out', {
    p_batch_id: input.batchId,
    p_quantity: input.quantity,
    p_note: input.note,
    p_actor: actor(req),
  })

  if (error) throw dbError(error)
  if (!data) throw new HttpError(500, 'Stock-out returned nothing.')

  res.status(201).json(toBatch(data))
}
