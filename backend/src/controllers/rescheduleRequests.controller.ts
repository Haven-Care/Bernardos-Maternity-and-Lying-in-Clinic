import type { Request, Response } from 'express'
import { z } from 'zod'
import { getSupabaseClient } from '../config/supabase.js'
import { unwrap, unwrapList } from '../lib/db.js'
import { parseBody } from '../lib/validate.js'
import { HttpError } from '../middleware/errorHandler.js'
import { toRescheduleRequest } from '../mappers/appointment.js'
import { applyReschedule } from './appointments.controller.js'

/**
 * The staff side of patient-initiated reschedules.
 *
 * This surface has no Figma frame — the design models reschedule only as
 * something staff impose from the booking detail modal, which is gap #5 in the
 * flowchart spec. It is built against the language of that modal.
 */

const idSchema = z.string().uuid('Not a valid request id.')

const statusQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'declined']).optional(),
})

export async function listRescheduleRequests(req: Request, res: Response) {
  const { status } = parseBody(statusQuerySchema, req.query)

  let query = getSupabaseClient()
    .from('reschedule_requests')
    .select('*, appointments(*)')
    .order('requested_at', { ascending: false })

  // Defaults to the open queue, which is what the badge counts and what staff
  // actually need to act on.
  query = query.eq('status', status ?? 'pending')

  res.json(unwrapList(await query).map(toRescheduleRequest))
}

async function openRequest(id: string) {
  const row = unwrap(
    await getSupabaseClient()
      .from('reschedule_requests')
      .select('*, appointments(*)')
      .eq('id', id)
      .maybeSingle(),
    'No such request.',
  )

  if (row.status !== 'pending') {
    throw new HttpError(409, `That request was already ${row.status}.`)
  }

  return row
}

/**
 * POST /api/reschedule-requests/:id/approve
 *
 * Applies the move through the same path the staff reschedule modal uses, so
 * the capacity check is the identical one — the slot can have filled in the
 * time the request sat in the queue, and approving must not be a way around
 * that.
 *
 * The booking is moved first. If that fails the request stays open, which is
 * the right way round: a request marked approved against a booking that never
 * moved would tell staff a job was done that was not.
 */
export async function approveRescheduleRequest(req: Request, res: Response) {
  const id = parseBody(idSchema, req.params.id)
  const request = await openRequest(id)

  await applyReschedule(
    request.booking_id,
    request.proposed_date,
    request.proposed_time,
  )

  const row = unwrap(
    await getSupabaseClient()
      .from('reschedule_requests')
      .update({
        status: 'approved',
        decided_at: new Date().toISOString(),
        decided_by: req.staff?.userId ?? null,
      })
      .eq('id', id)
      .select('*, appointments(*)')
      .single(),
  )

  res.json(toRescheduleRequest(row))
}

export async function declineRescheduleRequest(req: Request, res: Response) {
  const id = parseBody(idSchema, req.params.id)
  await openRequest(id)

  // The booking is untouched — it keeps the date and slot it already had,
  // which is the whole reason the proposal lived in a separate row.
  const row = unwrap(
    await getSupabaseClient()
      .from('reschedule_requests')
      .update({
        status: 'declined',
        decided_at: new Date().toISOString(),
        decided_by: req.staff?.userId ?? null,
      })
      .eq('id', id)
      .select('*, appointments(*)')
      .single(),
  )

  res.json(toRescheduleRequest(row))
}
