import type { Request, Response } from 'express'
import { z } from 'zod'
import { getSupabaseClient } from '../config/supabase.js'
import { dbError, unwrap, unwrapList } from '../lib/db.js'
import { isoDate, parseBody } from '../lib/validate.js'
import { HttpError } from '../middleware/errorHandler.js'
import { toBooking } from '../mappers/appointment.js'
import type { Database } from '../db/types.js'

type Status = Database['public']['Enums']['appointment_status']

const idSchema = z.string().uuid('Not a valid booking id.')
const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/

const rescheduleSchema = z.object({
  scheduledDate: isoDate('Choose a date.'),
  slotTime: z.string().regex(TIME, 'Choose a time.'),
})

export async function listBookings(_req: Request, res: Response) {
  const rows = unwrapList(
    await getSupabaseClient()
      .from('appointments')
      .select('*')
      .order('scheduled_date', { ascending: false })
      .order('slot_time'),
  )

  res.json(rows.map(toBooking))
}

export async function getBooking(req: Request, res: Response) {
  const id = parseBody(idSchema, req.params.id)

  const row = unwrap(
    await getSupabaseClient()
      .from('appointments')
      .select('*')
      .eq('id', id)
      .maybeSingle(),
    'No such booking.',
  )

  res.json(toBooking(row))
}

/**
 * GET /api/bookings/reference/:referenceNo
 *
 * Look-up by the BR-0812 a patient was given.
 *
 * Staff-only, like everything else on this router. A patient holding their own
 * reference number reads it from My Bookings, where ownership is checked —
 * making this public would turn a four-digit sequential reference into a way to
 * page through the clinic's entire appointment book.
 */
export async function getBookingByReference(req: Request, res: Response) {
  // Exact match on the stored upper-case form. `ilike` would read `%` and `_`
  // as wildcards, so `BR-%` matched every booking and turned into a 500.
  const referenceNo = parseBody(
    z.string().trim().min(1, 'Enter a reference number.'),
    req.params.referenceNo,
  ).toUpperCase()

  const row = unwrap(
    await getSupabaseClient()
      .from('appointments')
      .select('*')
      .eq('reference_no', referenceNo)
      .maybeSingle(),
    `No booking found for ${referenceNo}.`,
  )

  res.json(toBooking(row))
}

/**
 * Moves a booking to a new status.
 *
 * Guarded by which transitions make sense: a cancelled booking is finished, and
 * confirming or completing one would silently resurrect an appointment the
 * patient was told was off.
 */
async function setStatus(id: string, next: Status, allowedFrom: Status[]) {
  const db = getSupabaseClient()

  const current = unwrap(
    await db.from('appointments').select('status').eq('id', id).maybeSingle(),
    'No such booking.',
  )

  if (!allowedFrom.includes(current.status)) {
    throw new HttpError(
      409,
      `A ${current.status} appointment cannot be marked ${next}.`,
    )
  }

  return unwrap(
    await db
      .from('appointments')
      .update({ status: next })
      .eq('id', id)
      .select('*')
      .single(),
  )
}

/**
 * Closes the open reschedule request on a booking that was just cancelled.
 *
 * Left pending, it stays in the staff queue and the Urgent Alerts count for an
 * appointment that no longer exists, and approving it can only fail. Shared
 * with the patient's own cancel in patientPortal.controller.ts.
 */
export async function declineOpenRescheduleRequest(bookingId: string) {
  const { error } = await getSupabaseClient()
    .from('reschedule_requests')
    .update({ status: 'declined', decided_at: new Date().toISOString() })
    .eq('booking_id', bookingId)
    .eq('status', 'pending')

  if (error) throw dbError(error)
}

export async function confirmBooking(req: Request, res: Response) {
  const id = parseBody(idSchema, req.params.id)
  res.json(toBooking(await setStatus(id, 'confirmed', ['pending', 'rescheduled'])))
}

/**
 * DELETE /api/bookings/:id
 *
 * Cancels rather than deletes. The appointment stays in the record — the
 * Dashboard charts cancellations, and a clinic needs to know a slot was held
 * and given up rather than never booked.
 */
export async function cancelBooking(req: Request, res: Response) {
  const id = parseBody(idSchema, req.params.id)
  const row = await setStatus(id, 'cancelled', [
    'pending',
    'confirmed',
    'rescheduled',
  ])

  await declineOpenRescheduleRequest(id)
  res.json(toBooking(row))
}

export async function completeBooking(req: Request, res: Response) {
  const id = parseBody(idSchema, req.params.id)
  // Completing straight from pending is allowed: a walk-in the clinic saw
  // without ever formally confirming still happened.
  res.json(
    toBooking(
      await setStatus(id, 'completed', ['pending', 'confirmed', 'rescheduled']),
    ),
  )
}

/**
 * PATCH /api/bookings/:id/reschedule
 *
 * Staff moving an appointment directly — their schedule, their call, no request
 * and no approval. The patient-initiated path is a `reschedule_requests` row
 * and goes through the queue instead.
 *
 * The target slot is still checked: moving someone into a slot that is full or
 * blocked would create exactly the double-booking the system exists to prevent,
 * and a mistake made by staff fills the room just as effectively as one made by
 * a patient.
 */
export async function rescheduleBooking(req: Request, res: Response) {
  const id = parseBody(idSchema, req.params.id)
  const input = parseBody(rescheduleSchema, req.body)

  const row = await applyReschedule(id, input.scheduledDate, input.slotTime)
  res.json(toBooking(row))
}

/**
 * The staff path to `reschedule_appointment`. Patient requests reach the same
 * function through `approve_reschedule_request`.
 *
 * The status, date and capacity checks and the update all happen in that one
 * function, under the same advisory locks `book_appointment` takes. Done here
 * as a read, a check and a write, a new booking could take the last seat
 * between the check and the write and the slot would end up over capacity.
 */
export async function applyReschedule(
  bookingId: string,
  date: string,
  time: string,
) {
  const { data, error } = await getSupabaseClient().rpc(
    'reschedule_appointment',
    { p_booking_id: bookingId, p_scheduled_date: date, p_slot_time: time },
  )

  if (error) throw dbError(error)
  if (!data) throw new HttpError(500, 'Reschedule returned nothing.')

  return data
}
