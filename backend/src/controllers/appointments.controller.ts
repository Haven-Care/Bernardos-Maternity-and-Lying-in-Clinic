import type { Request, Response } from 'express'
import { z } from 'zod'
import { getSupabaseClient } from '../config/supabase.js'
import { dbError, unwrap, unwrapList } from '../lib/db.js'
import { parseBody } from '../lib/validate.js'
import { HttpError } from '../middleware/errorHandler.js'
import { toBooking } from '../mappers/appointment.js'
import type { Database } from '../db/types.js'

type Status = Database['public']['Enums']['appointment_status']

const idSchema = z.string().uuid('Not a valid booking id.')
const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

const rescheduleSchema = z.object({
  scheduledDate: z.string().regex(DATE, 'Choose a date.'),
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
  const referenceNo = parseBody(
    z.string().trim().min(1, 'Enter a reference number.'),
    req.params.referenceNo,
  )

  const row = unwrap(
    await getSupabaseClient()
      .from('appointments')
      .select('*')
      .ilike('reference_no', referenceNo)
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
async function setStatus(
  id: string,
  next: Status,
  allowedFrom: Status[],
  res: Response,
) {
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

  const row = unwrap(
    await db
      .from('appointments')
      .update({ status: next })
      .eq('id', id)
      .select('*')
      .single(),
  )

  res.json(toBooking(row))
}

export async function confirmBooking(req: Request, res: Response) {
  const id = parseBody(idSchema, req.params.id)
  await setStatus(id, 'confirmed', ['pending', 'rescheduled'], res)
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
  await setStatus(
    id,
    'cancelled',
    ['pending', 'confirmed', 'rescheduled'],
    res,
  )
}

export async function completeBooking(req: Request, res: Response) {
  const id = parseBody(idSchema, req.params.id)
  // Completing straight from pending is allowed: a walk-in the clinic saw
  // without ever formally confirming still happened.
  await setStatus(id, 'completed', ['pending', 'confirmed', 'rescheduled'], res)
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
 * Shared by the staff reschedule modal and the approval of a patient's request,
 * so both enforce the same capacity rule and both land on `rescheduled`.
 */
export async function applyReschedule(
  bookingId: string,
  date: string,
  time: string,
) {
  const db = getSupabaseClient()

  const booking = unwrap(
    await db
      .from('appointments')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle(),
    'No such booking.',
  )

  if (booking.status === 'cancelled' || booking.status === 'completed') {
    throw new HttpError(
      409,
      `A ${booking.status} appointment cannot be rescheduled.`,
    )
  }

  const { data: slots, error } = await db.rpc('slot_availability', {
    target_date: date,
  })

  if (error) throw dbError(error)

  const slot = slots.find((s) => s.slot_time === time)

  if (!slot || !slot.is_open) {
    throw new HttpError(409, 'That time is not available on that date.')
  }

  // The booking itself occupies a seat when it is already on that date and
  // time, so exclude it before comparing — otherwise moving 08:00 to 08:00
  // would report the slot as full against itself.
  const alreadyThere =
    booking.scheduled_date === date && booking.slot_time === time

  if (!alreadyThere && slot.booked >= slot.capacity) {
    throw new HttpError(409, 'That time is fully booked.')
  }

  return unwrap(
    await db
      .from('appointments')
      .update({
        scheduled_date: date,
        slot_time: time,
        status: 'rescheduled',
      })
      .eq('id', bookingId)
      .select('*')
      .single(),
  )
}
