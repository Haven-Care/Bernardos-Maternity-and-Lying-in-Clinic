import type { Request, Response } from 'express'
import { z } from 'zod'
import { getSupabaseClient } from '../config/supabase.js'
import { unwrap, unwrapList } from '../lib/db.js'
import { isoDate, parseBody, parseQuery } from '../lib/validate.js'
import { toSlot, toSlotAvailability } from '../mappers/clinic.js'

const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

const slotInputSchema = z.object({
  weekday: z.enum(WEEKDAYS),
  // The domain in the database enforces this too; catching it here means a
  // typo comes back as a readable message rather than a constraint violation.
  time: z
    .string()
    .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'Time must look like 08:00.'),
  capacity: z.number().int().positive('Capacity must be at least 1.'),
})

const slotPatchSchema = slotInputSchema
  .partial()
  .extend({ isOpen: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.')

const idSchema = z.string().uuid('Not a valid slot id.')

const listQuerySchema = z.object({
  weekday: z.enum(WEEKDAYS).optional(),
})

const availabilityQuerySchema = z.object({
  date: isoDate('Date must look like 2026-09-21.'),
})

/**
 * GET /api/slots/weekdays — public.
 *
 * The weekdays on which the clinic has at least one open slot, and nothing
 * else. The booking form needs this to grey out the days it cannot offer, and
 * before this endpoint existed it asked `GET /slots` — which is staff-only, so
 * every patient got a 403 and a date strip with every day disabled.
 *
 * A projection rather than opening up `/slots`, because that list carries
 * capacities and *blocked* slots. Which days the clinic opens is already
 * derivable from `/slots/availability` one date at a time, and from the
 * opening hours on the clinic's own signage; how many patients fit in the
 * 10 AM slot, or that Thursday was deliberately blocked, is not.
 */
export async function listOpenWeekdays(_req: Request, res: Response) {
  const rows = unwrapList(
    await getSupabaseClient()
      .from('appointment_slots')
      .select('weekday')
      .eq('is_open', true),
  )

  res.json(WEEKDAYS.filter((day) => rows.some((row) => row.weekday === day)))
}

export async function listSlots(req: Request, res: Response) {
  const { weekday } = parseQuery(listQuerySchema, req.query)

  let query = getSupabaseClient()
    .from('appointment_slots')
    .select('*')
    .order('slot_time')

  if (weekday) query = query.eq('weekday', weekday)

  res.json(unwrapList(await query).map(toSlot))
}

/**
 * GET /api/slots/availability?date=YYYY-MM-DD
 *
 * Backs both the Appointment Slots table's "Booked Today" column and the public
 * booking form's list of open times.
 *
 * The occupancy count comes from the `slot_availability` function rather than
 * being assembled here, so the definition of "taken" lives in one place — the
 * same place `book_appointment` enforces it. If this counted differently from
 * the booking function, the form would offer times that then refused the
 * booking.
 */
export async function listAvailability(req: Request, res: Response) {
  const { date } = parseQuery(availabilityQuerySchema, req.query)

  const rows = unwrapList(
    await getSupabaseClient().rpc('slot_availability', { target_date: date }),
  )

  res.json(rows.map(toSlotAvailability))
}

export async function createSlot(req: Request, res: Response) {
  const input = parseBody(slotInputSchema, req.body)

  const result = await getSupabaseClient()
    .from('appointment_slots')
    .insert({
      weekday: input.weekday,
      slot_time: input.time,
      capacity: input.capacity,
    })
    .select('*')
    .single()

  // The unique index on (weekday, slot_time) is what actually prevents a
  // duplicate; naming the clash makes the message useful.
  if (result.error?.code === '23505') {
    res.status(409).json({
      error: `A ${input.time} slot already exists on ${input.weekday}.`,
    })
    return
  }

  res.status(201).json(toSlot(unwrap(result)))
}

/**
 * PATCH /api/slots/:id
 *
 * Also the block/unblock toggle. Blocking hides a slot from the booking form
 * immediately and leaves bookings already in it untouched — which is the point:
 * staff block a time to stop *new* bookings on a day that is already partly
 * booked, not to cancel anyone.
 */
export async function updateSlot(req: Request, res: Response) {
  const id = parseBody(idSchema, req.params.id)
  const input = parseBody(slotPatchSchema, req.body)

  const row = unwrap(
    await getSupabaseClient()
      .from('appointment_slots')
      .update({
        ...(input.weekday !== undefined && { weekday: input.weekday }),
        ...(input.time !== undefined && { slot_time: input.time }),
        ...(input.capacity !== undefined && { capacity: input.capacity }),
        ...(input.isOpen !== undefined && { is_open: input.isOpen }),
      })
      .eq('id', id)
      .select('*')
      .maybeSingle(),
    'No such slot.',
  )

  res.json(toSlot(row))
}
