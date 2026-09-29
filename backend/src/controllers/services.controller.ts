import type { Request, Response } from 'express'
import { z } from 'zod'
import { getSupabaseClient } from '../config/supabase.js'
import { unwrap, unwrapList } from '../lib/db.js'
import { parseBody } from '../lib/validate.js'
import { toService } from '../mappers/clinic.js'

const serviceInputSchema = z.object({
  name: z.string().trim().min(1, 'Service name is required.'),
  category: z.string().trim().default(''),
  price: z.number().min(0, 'Price cannot be negative.'),
})

// PATCH carries either a full edit or just the active toggle, so every field is
// optional — but an empty body is a mistake, not a no-op.
const servicePatchSchema = serviceInputSchema
  .partial()
  .extend({ active: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.')

const idSchema = z.string().uuid('Not a valid service id.')

/**
 * GET /api/services
 *
 * Scoped by who is asking. Staff see everything, including deactivated
 * services, because Services & Pricing has to show them in order to switch one
 * back on. Anyone else sees only what is currently offered — a deactivated
 * service is not information the public booking form should have.
 */
export async function listServices(req: Request, res: Response) {
  let query = getSupabaseClient().from('services').select('*').order('name')

  if (!req.staff || req.query.active === 'true') {
    query = query.eq('active', true)
  }

  res.json(unwrapList(await query).map(toService))
}

export async function createService(req: Request, res: Response) {
  const input = parseBody(serviceInputSchema, req.body)

  const row = unwrap(
    await getSupabaseClient()
      .from('services')
      .insert({ name: input.name, category: input.category, price: input.price })
      .select('*')
      .single(),
  )

  res.status(201).json(toService(row))
}

export async function updateService(req: Request, res: Response) {
  const id = parseBody(idSchema, req.params.id)
  const input = parseBody(servicePatchSchema, req.body)

  const row = unwrap(
    await getSupabaseClient()
      .from('services')
      .update(input)
      .eq('id', id)
      .select('*')
      .maybeSingle(),
    'No such service.',
  )

  res.json(toService(row))
}
