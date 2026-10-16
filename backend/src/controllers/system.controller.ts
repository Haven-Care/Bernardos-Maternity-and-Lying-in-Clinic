import type { Request, Response } from 'express'
import { z } from 'zod'
import { parseBody } from '../lib/validate.js'
import {
  createStaffAccount,
  createStaffSchema,
  listStaff,
  setStaffStatus,
} from '../services/staff.js'

/**
 * Staff provisioning — the API behind the unlisted /admin/system screen.
 *
 * Absent from the Figma because provisioning is not a feature the clinic asked
 * for a screen for; it exists because accounts have to come from somewhere and
 * a command line is not something the clinic will run.
 *
 * Every route here is administrator-only. That is enforced by requireRole in
 * the router, not by the screen being hard to find — an unlisted URL is not a
 * permission.
 */

export async function getStaff(_req: Request, res: Response) {
  res.json(await listStaff())
}

export async function postStaff(req: Request, res: Response) {
  const input = parseBody(createStaffSchema, req.body)
  res.status(201).json(await createStaffAccount(input))
}

const statusSchema = z.object({
  status: z.enum(['active', 'inactive']),
})

// Express 5 types a route param as `string | string[]`, since `?id=a&id=b`
// produces an array. Parsing rather than casting narrows it and rejects a
// non-uuid before it reaches a query.
const idParamSchema = z.string().uuid('Not a valid staff id.')

export async function patchStaffStatus(req: Request, res: Response) {
  const { status } = parseBody(statusSchema, req.body)
  const id = parseBody(idParamSchema, req.params.id)

  // An administrator locking themselves out is recoverable only by someone
  // else with the role, and there may not be anyone else.
  if (id === req.staff?.userId && status === 'inactive') {
    res.status(400).json({ error: 'You cannot deactivate your own account.' })
    return
  }

  res.json(await setStaffStatus(id, status))
}
