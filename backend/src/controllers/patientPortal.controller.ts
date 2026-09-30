import type { Request, Response } from 'express'
import { z } from 'zod'
import { getSupabaseClient } from '../config/supabase.js'
import { dbError, unwrap, unwrapList } from '../lib/db.js'
import { isoDate, parseBody } from '../lib/validate.js'
import { HttpError } from '../middleware/errorHandler.js'
import {
  toBooking,
  toPatientAccount,
  toRescheduleRequest,
} from '../mappers/appointment.js'
import { declineOpenRescheduleRequest } from './appointments.controller.js'

/**
 * The patient's own view of their bookings.
 *
 * **Every handler here filters by the account id on the JWT, never by one the
 * client supplies.** There is no route in this file that takes an account id,
 * and there must not be: a patient asking for "their" bookings and a patient
 * asking for someone else's must be the same request, indistinguishable, so
 * that the second cannot be made at all.
 *
 * Ownership is asserted on each row as well as in the filter. A booking id in a
 * URL is a guess anyone can make.
 */

const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/
const idSchema = z.string().uuid('Not a valid booking id.')

function account(req: Request) {
  if (!req.patient) {
    throw new HttpError(500, 'Patient route mounted without requirePatient')
  }
  return req.patient
}

/** Loads a booking, or 404s if it is not this patient's. */
async function ownBooking(req: Request, bookingId: string) {
  const me = account(req)

  const booking = unwrap(
    await getSupabaseClient()
      .from('appointments')
      .select('*')
      .eq('id', bookingId)
      .eq('account_id', me.userId)
      .maybeSingle(),
    // Deliberately the same answer as a booking that does not exist. "Not
    // yours" would confirm the reference belongs to somebody.
    'No such booking.',
  )

  return booking
}

export async function getMyAccount(req: Request, res: Response) {
  const me = account(req)

  const row = unwrap(
    await getSupabaseClient()
      .from('patient_accounts')
      .select('*')
      .eq('id', me.userId)
      .maybeSingle(),
    'No account found.',
  )

  res.json(toPatientAccount(row))
}

const profileSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Your name is required.').optional(),
    contactNumber: z.string().trim().optional(),
    emailNotifications: z.boolean().optional(),
    smsReminders: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.')

export async function updateMyAccount(req: Request, res: Response) {
  const me = account(req)
  const input = parseBody(profileSchema, req.body)

  // The email is not editable here. Changing it changes the address that signs
  // in and receives password resets, which needs a confirmation round trip
  // rather than a text field on a profile page.
  const row = unwrap(
    await getSupabaseClient()
      .from('patient_accounts')
      .update({
        ...(input.fullName !== undefined && { full_name: input.fullName }),
        ...(input.contactNumber !== undefined && {
          contact_number: input.contactNumber,
        }),
        ...(input.emailNotifications !== undefined && {
          email_notifications: input.emailNotifications,
        }),
        ...(input.smsReminders !== undefined && {
          sms_reminders: input.smsReminders,
        }),
      })
      .eq('id', me.userId)
      .select('*')
      .maybeSingle(),
    'No account found.',
  )

  res.json(toPatientAccount(row))
}

export async function listMyBookings(req: Request, res: Response) {
  const me = account(req)

  const rows = unwrapList(
    await getSupabaseClient()
      .from('appointments')
      .select('*')
      .eq('account_id', me.userId)
      .order('scheduled_date', { ascending: false }),
  )

  res.json(rows.map(toBooking))
}

const createBookingSchema = z.object({
  serviceId: z.string().uuid('Choose a service.'),
  scheduledDate: isoDate('Choose a date.'),
  slotTime: z.string().regex(TIME, 'Choose a time.'),
  reasonForVisit: z.string().trim().default(''),
  // Optional overrides. The account already knows these, but the booking form
  // lets a patient correct the number they want called on the day.
  patientName: z.string().trim().min(1).optional(),
  contactNumber: z.string().trim().optional(),
})

/**
 * POST /api/bookings
 *
 * Calls `book_appointment`, which holds an advisory lock on the date and time
 * for the length of the transaction. That is what makes double-booking
 * structurally impossible rather than merely unlikely: without it, two patients
 * both read "1 of 2 booked", both pass the check, and both insert.
 *
 * The same function materialises the patient's clinical record on their first
 * booking, in the same transaction as the booking that caused it.
 *
 * Lands on `confirmed`. Submitting the form *is* the booking — every rule the
 * clinic has was checked inside the function, under the lock, before the row
 * existed. Staff monitor the schedule rather than admit people to it.
 */
export async function createMyBooking(req: Request, res: Response) {
  const me = account(req)
  const input = parseBody(createBookingSchema, req.body)

  const { data, error } = await getSupabaseClient().rpc('book_appointment', {
    p_account_id: me.userId,
    p_service_id: input.serviceId,
    p_scheduled_date: input.scheduledDate,
    p_slot_time: input.slotTime,
    p_patient_name: input.patientName ?? me.fullName,
    p_contact_number: input.contactNumber ?? me.contactNumber,
    p_email: me.email,
    p_reason_for_visit: input.reasonForVisit,
  })

  // The rejection messages come from the database and are written for a
  // patient — "That time was just filled" — so they are passed through as they
  // are rather than replaced with a status code.
  if (error) throw dbError(error)
  if (!data) throw new HttpError(500, 'Booking returned nothing.')

  res.status(201).json(toBooking(data))
}

/**
 * DELETE /api/me/bookings/:id
 *
 * Applies immediately, unlike a reschedule. A patient giving up their slot
 * costs the clinic nothing and frees the time for someone else; making them
 * wait for approval to cancel would keep a room booked that nobody is coming
 * to.
 */
export async function cancelMyBooking(req: Request, res: Response) {
  const id = parseBody(idSchema, req.params.id)
  const booking = await ownBooking(req, id)

  if (booking.status === 'completed') {
    throw new HttpError(409, 'That appointment has already happened.')
  }

  if (booking.status === 'cancelled') {
    // Already where they wanted to be. Returning the booking rather than an
    // error means a double-tap on a phone is not an error message.
    res.json(toBooking(booking))
    return
  }

  // Conditional on the status still being cancellable, for the same reason as
  // setStatus: staff completing the visit at the same moment must not be
  // overwritten by this write.
  const { data: row, error } = await getSupabaseClient()
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .not('status', 'in', '(completed,cancelled)')
    .select('*')
    .maybeSingle()

  if (error) throw dbError(error)
  if (!row) {
    throw new HttpError(409, 'That appointment changed while you were cancelling it.')
  }

  await declineOpenRescheduleRequest(id)
  res.json(toBooking(row))
}

const requestRescheduleSchema = z.object({
  proposedDate: isoDate('Choose a date.'),
  proposedTime: z.string().regex(TIME, 'Choose a time.'),
})

/**
 * POST /api/me/bookings/:id/reschedule-request
 *
 * Creates a *request*. The booking does not move, and its slot stays held,
 * until staff approve it.
 *
 * This is the pitch's central claim made literal — the app collects requests
 * and does not book appointments. A patient silently rewriting a confirmed date
 * would contradict the sentence the clinic was sold on.
 */
export async function requestReschedule(req: Request, res: Response) {
  const id = parseBody(idSchema, req.params.id)
  const input = parseBody(requestRescheduleSchema, req.body)
  const booking = await ownBooking(req, id)

  if (booking.status === 'cancelled' || booking.status === 'completed') {
    throw new HttpError(
      409,
      `A ${booking.status} appointment cannot be rescheduled.`,
    )
  }

  if (
    booking.scheduled_date === input.proposedDate &&
    booking.slot_time === input.proposedTime
  ) {
    throw new HttpError(400, 'That is the time you already have.')
  }

  const db = getSupabaseClient()

  // clinic_today() rather than the server clock, the same "today" that
  // book_appointment and reschedule_appointment refuse past dates against.
  const today = await db.rpc('clinic_today')
  if (today.error) throw dbError(today.error)

  if (input.proposedDate < today.data) {
    throw new HttpError(
      400,
      'That date has already passed. Please choose another one.',
    )
  }

  // Checked before the request is filed, so a patient is told now rather than
  // waiting for staff to decline something that was never possible. Staff still
  // re-check on approval, because the slot can fill in between.
  const { data: slots, error } = await db.rpc('slot_availability', {
    target_date: input.proposedDate,
  })

  if (error) throw dbError(error)

  const slot = slots.find((s) => s.slot_time === input.proposedTime)

  if (!slot || !slot.is_open) {
    throw new HttpError(
      409,
      'That time is no longer available. Please choose another one.',
    )
  }

  if (slot.booked >= slot.capacity) {
    throw new HttpError(
      409,
      'That time is fully booked. Please choose another one.',
    )
  }

  const result = await db
    .from('reschedule_requests')
    .insert({
      booking_id: id,
      proposed_date: input.proposedDate,
      proposed_time: input.proposedTime,
    })
    .select('*, appointments(*)')
    .single()

  // The partial unique index allows one open request per booking. A second is
  // not an error to hide — staff would not know which one approving applies.
  if (result.error?.code === '23505') {
    throw new HttpError(
      409,
      'You already have a reschedule request waiting on this appointment.',
    )
  }

  res.status(201).json(toRescheduleRequest(unwrap(result)))
}

export async function listMyRescheduleRequests(req: Request, res: Response) {
  const me = account(req)

  const rows = unwrapList(
    await getSupabaseClient()
      .from('reschedule_requests')
      .select('*, appointments!inner(*)')
      .eq('appointments.account_id', me.userId)
      .order('requested_at', { ascending: false }),
  )

  res.json(rows.map(toRescheduleRequest))
}
