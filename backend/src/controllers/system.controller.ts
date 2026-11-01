import type { Request, Response } from 'express'
import { z } from 'zod'
import { audit } from '../lib/audit.js'
import { parseBody } from '../lib/validate.js'
import {
  countActiveAdministrators,
  createStaffAccount,
  createStaffSchema,
  findStaff,
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
  const profile = await createStaffAccount(input)
  await audit(req, 'staff.create', { entityId: profile.id, details: { role: profile.role } })
  res.status(201).json(profile)
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

  // The self-check above does not stop two administrators deactivating each
  // other, which leaves the clinic with nobody who can create accounts.
  if (status === 'inactive') {
    const target = await findStaff(id)
    if (target?.role === 'administrator' && target.status === 'active' && (await countActiveAdministrators()) <= 1) {
      res.status(409).json({ error: 'At least one active administrator must remain.' })
      return
    }
  }

  const profile = await setStaffStatus(id, status)
  await audit(req, 'staff.status', { entityId: id, details: { status } })
  res.json(profile)
}
