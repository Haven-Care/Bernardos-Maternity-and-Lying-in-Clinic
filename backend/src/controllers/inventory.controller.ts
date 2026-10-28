import { text, wholeNumber, money, MAX_INTEGER } from '../lib/inputValidation.js'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { getSupabaseClient } from '../config/supabase.js'
import { dbError, definedOnly, unwrap, unwrapList } from '../lib/db.js'
import { isoDate, parseBody, parseQuery } from '../lib/validate.js'
import { afterClinicDay, datedListQuery } from '../lib/dateRange.js'
import { batchNumberSchema } from '../lib/batchNumber.js'
import { HttpError } from '../middleware/errorHandler.js'
import {
  daysBetween,
  toBatch,
  toExpiringRow,
  toMedicineListRow,
  toMovement,
} from '../mappers/inventory.js'

const idSchema = z.string().uuid('Not a valid id.')

const medicineFields = z.object({
  genericName: text().min(1, 'Generic name is required.'),
  brandName: text(200).default(''),
  // Free text, not an enum: the four observed values are the filter's options,
  // and the seed already needs "Obstetric" for Oxytocin.
  category: text(100).default(''),
  dosageForm: z.enum(['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment']),
  dosage: text(200).min(1, 'Dosage is required.'),
  unit: text(50).min(1, 'Choose a unit.').default('pcs'),
  reorderLevel: wholeNumber().default(0),
  targetStockLevel: wholeNumber().nullable().optional(),
  unitCost: money().default(0),
  sellingPrice: money().default(0),
  supplierName: text(200).default(''),
  supplierContact: text(200).default(''),
  storageLocation: text(200).default(''),
})

const medicineSchema = medicineFields.refine((value) => value.targetStockLevel == null || value.targetStockLevel >= value.reorderLevel, { message: 'Target stock must be at least the reorder level.', path: ['targetStockLevel'] })

// PATCH validates only what it is sent and applies none of the create
// defaults: an edit that omits `reorderLevel` must not reset it to 0, which
// would quietly change what counts as Low Stock.
const medicinePatchSchema = z
  .object({
    genericName: text().min(1, 'Generic name is required.'),
    brandName: text(200),
    category: text(100),
    dosageForm: z.enum(['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment']),
    dosage: text(200).min(1, 'Dosage is required.'),
    unit: text(50).min(1, 'Choose a unit.'),
    reorderLevel: wholeNumber(),
    targetStockLevel: wholeNumber().nullable().optional(),
    unitCost: money(),
    sellingPrice: money(),
    supplierName: text(200),
    supplierContact: text(200),
    storageLocation: text(200),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.')

function toRow(input: z.infer<typeof medicineSchema>) {
  return {
    generic_name: input.genericName,
    brand_name: input.brandName,
    category: input.category,
    dosage_form: input.dosageForm,
    dosage: input.dosage,
    unit: input.unit,
    reorder_level: input.reorderLevel,
    target_stock_level: input.targetStockLevel,
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

export async function listMedicines(req: Request, res: Response) {
  let query = getSupabaseClient().from('medicine_stock').select('*').order('generic_name')
  if (req.query.includeArchived !== 'true') query = query.eq('active', true)
  const rows = unwrapList(await query)

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
  const { offset, limit } = parseQuery(datedListQuery, req.query)

  const rows = unwrapList(
    await getSupabaseClient()
      .from('medicine_batches')
      .select('*')
      .eq('medicine_id', medicineId)
      .order('expires_at').order('id').range(offset, offset + limit - 1),
  )

  res.json(rows.map(toBatch))
}

export async function listMovements(req: Request, res: Response) {
  const { from, to, offset, limit } = parseQuery(datedListQuery, req.query)
  let query = getSupabaseClient().from('stock_movements').select('*, profiles(full_name), medicines(generic_name, brand_name, dosage, unit), medicine_batches(batch_no, manufacturer_lot)')
    .order('occurred_at', { ascending: false }).order('id')
  if (req.query.batchId) query = query.eq('batch_id', parseBody(idSchema, req.query.batchId))
  if (from) query = query.gte('occurred_at', `${from}T00:00:00+08:00`)
  if (to) query = query.lt('occurred_at', afterClinicDay(to))
  const rows = unwrapList(await query.range(offset, offset + limit - 1))
  const ids = rows.map((row) => row.id)
  // Keep each REST URL below proxy URI limits for a full 500-entry page.
  const chunks = Array.from({ length: Math.ceil(ids.length / 100) }, (_, index) => ids.slice(index * 100, (index + 1) * 100))
  const reversals = (await Promise.all(chunks.map(async (chunk) => unwrapList(await getSupabaseClient().from('stock_movements').select('reverses_movement_id').in('reverses_movement_id', chunk))))).flat()
  const reversed = new Set(reversals.map((row) => row.reverses_movement_id))
  res.json(rows.map((row) => {
    const snapshot = row.medicine_snapshot && typeof row.medicine_snapshot === 'object' && !Array.isArray(row.medicine_snapshot) ? row.medicine_snapshot : {}
    const batch = row.batch_snapshot && typeof row.batch_snapshot === 'object' && !Array.isArray(row.batch_snapshot) ? row.batch_snapshot : {}
    return { ...toMovement(row, row.created_by_name ?? row.profiles?.full_name ?? 'Former staff / system'), reversed: reversed.has(row.id),
      medicineName: String(snapshot.genericName ?? row.medicines?.generic_name ?? 'Historical medicine'),
      brandName: String(snapshot.brandName ?? row.medicines?.brand_name ?? ''),
      dosage: String(snapshot.dosage ?? row.medicines?.dosage ?? ''), unit: String(snapshot.unit ?? row.medicines?.unit ?? ''),
      batchNo: String(batch.batchNo ?? row.medicine_batches?.batch_no ?? ''),
      manufacturerLot: String(batch.manufacturerLot ?? row.medicine_batches?.manufacturer_lot ?? '') || null }
  }))
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
      .filter((m) => m.qtyOnHand <= m.reorderLevel)
      .map((m) => ({
        medicineId: m.id,
        genericName: m.genericName,
        qtyOnHand: m.qtyOnHand,
        reorderLevel: m.reorderLevel,
        targetStockLevel: m.targetStockLevel,
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
      .select('*, medicines(generic_name, unit)')
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
    lowStock: medicines.filter((m) => m.qtyOnHand <= m.reorderLevel).length,
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
  const input = parseBody(medicinePatchSchema, req.body)

  if (input.reorderLevel !== undefined || input.targetStockLevel !== undefined) {
    const current = unwrap(await getSupabaseClient().from('medicines').select('reorder_level, target_stock_level').eq('id', id).maybeSingle(), 'No such medicine.')
    const reorder = input.reorderLevel ?? current.reorder_level
    const target = input.targetStockLevel === undefined ? current.target_stock_level : input.targetStockLevel
    if (target != null && target < reorder) throw new HttpError(400, 'Target stock must be at least the reorder level.')
  }

  const updated = unwrap(
    await getSupabaseClient()
      .from('medicines')
      // The cast lets the partial body through the full mapper; the keys it
      // did not carry come out undefined and definedOnly drops them.
      .update(definedOnly(toRow(input as z.infer<typeof medicineSchema>)))
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
  batchNo: batchNumberSchema,
  quantity: wholeNumber().positive('Quantity must be at least 1.'),
  expiresAt: isoDate('Enter an expiry date.'),
  note: text(2000).default(''),
})

const stockOutSchema = z.object({
  batchId: z.string().uuid('Choose a batch.'),
  quantity: wholeNumber().positive('Quantity must be at least 1.'),
  note: text(2000).default(''),
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

export async function listAllBatches(req: Request, res: Response) {
  const { offset, limit } = parseQuery(datedListQuery, req.query)
  let query = getSupabaseClient().from('medicine_batches').select('*, medicines(generic_name, brand_name, dosage, unit, active)').order('received_at', { ascending: false }).order('id')
  if (req.query.medicineId) query = query.eq('medicine_id', parseBody(idSchema, req.query.medicineId))
  const rows = unwrapList(await query.range(offset, offset + limit - 1))
  res.json(rows.map((row) => ({ ...toBatch(row), medicineName: row.medicines?.generic_name ?? 'Historical medicine', brandName: row.medicines?.brand_name ?? '', dosage: row.medicines?.dosage ?? '', unit: row.medicines?.unit ?? '', medicineActive: row.medicines?.active ?? false })))
}

export async function listBatchEvents(req: Request, res: Response) {
  const id = parseBody(idSchema, req.params.id)
  const { offset, limit } = parseQuery(datedListQuery, req.query)
  const rows = unwrapList(await getSupabaseClient().from('inventory_batch_events').select('*, profiles(full_name)').eq('batch_id', id).order('occurred_at', { ascending: false }).order('id').range(offset, offset + limit - 1))
  res.json(rows.map((row) => ({ id: row.id, batchId: row.batch_id, action: row.action, reason: row.reason, createdBy: row.created_by_name ?? row.profiles?.full_name ?? 'Former staff / system', occurredAt: row.occurred_at })))
}

const receiptSchema = z.object({
  medicineId: idSchema, batchId: idSchema.optional(),
  manufacturerLot: text(64).default(''),
  quantity: wholeNumber().positive(), expiresAt: isoDate('Enter a valid expiry date.'),
  note: text(2000).min(1, 'Describe the receipt.'),
})
export async function receiveStock(req: Request, res: Response) {
  const input = parseBody(receiptSchema, req.body)
  const { data, error } = await getSupabaseClient().rpc('receive_inventory_stock', {
    p_medicine_id: input.medicineId, p_manufacturer_lot: input.manufacturerLot,
    p_quantity: input.quantity, p_expires_at: input.expiresAt, p_note: input.note,
    p_actor: actor(req), ...(input.batchId ? { p_batch_id: input.batchId } : {}),
  })
  if (error) throw dbError(error)
  if (!data) throw new HttpError(500, 'Receipt returned nothing.')
  res.status(201).json(toBatch(data))
}

const movementSchema = z.object({ quantity: z.number().int().min(-MAX_INTEGER).max(MAX_INTEGER).refine((value) => value !== 0, 'Quantity cannot be zero.'), reason: z.enum(['dispensed', 'disposed', 'adjustment']), note: text(2000).min(1, 'A reason is required.') })
export async function moveStock(req: Request, res: Response) {
  const id = parseBody(idSchema, req.params.id)
  const input = parseBody(movementSchema, req.body)
  if (input.reason !== 'adjustment' && input.quantity < 0) throw new HttpError(400, 'Enter a positive quantity.')
  const { data, error } = await getSupabaseClient().rpc('move_inventory_stock', { p_batch_id: id, p_quantity: input.quantity, p_reason: input.reason, p_note: input.note, p_actor: actor(req) })
  if (error) throw dbError(error)
  if (!data) throw new HttpError(500, 'Movement returned nothing.')
  res.json(toBatch(data))
}



export async function reverseMovement(req: Request, res: Response) {
  const id = parseBody(idSchema, req.params.id)
  const { note } = parseBody(z.object({ note: text(2000).min(1, 'Explain the correction.') }), req.body)
  const { data, error } = await getSupabaseClient().rpc('reverse_inventory_movement', { p_movement_id: id, p_note: note, p_actor: actor(req) })
  if (error) throw dbError(error)
  if (!data) throw new HttpError(500, 'Reversal returned nothing.')
  res.json(toBatch(data))
}

export async function archiveMedicine(req: Request, res: Response) {
  const id = parseBody(idSchema, req.params.id)
  const { archive } = parseBody(z.object({ archive: z.boolean() }), req.body)
  const { error } = await getSupabaseClient().rpc('archive_inventory_medicine', { p_medicine_id: id, p_archive: archive, p_actor: actor(req) })
  if (error) throw dbError(error)
  await getMedicine(req, res)
}
