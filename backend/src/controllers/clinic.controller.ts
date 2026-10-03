import type { Request, Response } from 'express'
import { z } from 'zod'
import { getSupabaseClient } from '../config/supabase.js'
import { unwrap, unwrapList } from '../lib/db.js'
import { parseBody } from '../lib/validate.js'
import {
  toClinicInfo,
  toClinicSettings,
  toOperatingHours,
} from '../mappers/clinic.js'

/**
 * Clinic identity, hours and settings.
 *
 * `clinic_info` and `clinic_settings` are single-row tables guarded by
 * `check (id = 1)`, so every read and write here targets that row explicitly.
 */

const clinicInfoSchema = z.object({
  name: z.string().trim().min(1, 'Clinic name is required.'),
  licenseNo: z.string().trim().default(''),
  address: z.string().trim().default(''),
  landline: z.string().trim().default(''),
  mobile: z.string().trim().default(''),
  email: z.string().trim().email('Enter a valid email address.').or(z.literal('')),
  website: z.string().trim().default(''),
})

const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/

const operatingHoursSchema = z
  .array(
    z.object({
      key: z.enum([
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
        'holidays',
      ]),
      label: z.string().trim().min(1),
      opensAt: z.string().regex(TIME).nullable(),
      closesAt: z.string().regex(TIME).nullable(),
      closed: z.boolean(),
    }),
  )
  // Mirrors the table's own constraint. Catching it here turns a raw check
  // violation into a sentence someone can act on.
  .superRefine((rows, ctx) => {
    const seen = new Set<string>()

    for (const [i, row] of rows.entries()) {
      // A repeated day would make the upsert touch one row twice, which
      // Postgres refuses outright.
      if (seen.has(row.key)) {
        ctx.addIssue({
          code: 'custom',
          path: [i],
          message: `${row.label} appears more than once.`,
        })
      }
      seen.add(row.key)

      if (row.closed && (row.opensAt || row.closesAt)) {
        ctx.addIssue({
          code: 'custom',
          path: [i],
          message: `${row.label} is marked closed but still has opening times.`,
        })
      }

      if (!row.closed && (!row.opensAt || !row.closesAt)) {
        ctx.addIssue({
          code: 'custom',
          path: [i],
          message: `${row.label} needs both an opening and a closing time.`,
        })
      }

      if (!row.closed && row.opensAt && row.closesAt && row.closesAt <= row.opensAt) {
        ctx.addIssue({
          code: 'custom',
          path: [i],
          message: `${row.label} closes before it opens.`,
        })
      }
    }
  })

const settingsSchema = z
  .object({
    nearExpiryDays: z.number().int().positive().optional(),
    reminderLeadHours: z.number().int().positive().optional(),
    dailyBookingCapacity: z.number().int().positive().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.')

export async function getClinicInfo(_req: Request, res: Response) {
  const row = unwrap(
    await getSupabaseClient()
      .from('clinic_info')
      .select('*')
      .eq('id', 1)
      .maybeSingle(),
    'Clinic details have not been set up yet.',
  )

  res.json(toClinicInfo(row))
}

export async function updateClinicInfo(req: Request, res: Response) {
  const input = parseBody(clinicInfoSchema, req.body)

  const row = unwrap(
    await getSupabaseClient()
      .from('clinic_info')
      .update({
        name: input.name,
        license_no: input.licenseNo,
        address: input.address,
        landline: input.landline,
        mobile: input.mobile,
        email: input.email,
        website: input.website,
      })
      .eq('id', 1)
      .select('*')
      .maybeSingle(),
    'Clinic details have not been set up yet.',
  )

  res.json(toClinicInfo(row))
}

export async function getOperatingHours(_req: Request, res: Response) {
  const rows = unwrapList(
    await getSupabaseClient().from('operating_hours').select('*'),
  )

  res.json(rows.map(toOperatingHours))
}

/**
 * PUT /api/clinic/hours
 *
 * A whole-table replace, because the UI edits the grid as one thing and a
 * per-row PATCH would let a half-saved week exist. Rows absent from the payload
 * are deleted — that is what makes "remove the Saturday row" expressible, and
 * an empty payload clears the grid.
 *
 * The delete and the upsert run in one transaction inside
 * `replace_operating_hours`, so a failure part-way leaves the week as it was.
 */
export async function replaceOperatingHours(req: Request, res: Response) {
  const rows = parseBody(operatingHoursSchema, req.body)

  const saved = unwrapList(
    await getSupabaseClient().rpc('replace_operating_hours', {
      p_rows: rows.map((r) => ({
        key: r.key,
        label: r.label,
        opens_at: r.opensAt,
        closes_at: r.closesAt,
        closed: r.closed,
      })),
    }),
  )

  res.json(saved.map(toOperatingHours))
}

export async function getSettings(_req: Request, res: Response) {
  const row = unwrap(
    await getSupabaseClient()
      .from('clinic_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle(),
    'Clinic settings have not been set up yet.',
  )

  res.json(toClinicSettings(row))
}

export async function updateSettings(req: Request, res: Response) {
  const input = parseBody(settingsSchema, req.body)

  const row = unwrap(
    await getSupabaseClient()
      .from('clinic_settings')
      .update({
        ...(input.nearExpiryDays !== undefined && {
          near_expiry_days: input.nearExpiryDays,
        }),
        ...(input.reminderLeadHours !== undefined && {
          reminder_lead_hours: input.reminderLeadHours,
        }),
        ...(input.dailyBookingCapacity !== undefined && {
          daily_booking_capacity: input.dailyBookingCapacity,
        }),
      })
      .eq('id', 1)
      .select('*')
      .maybeSingle(),
    'Clinic settings have not been set up yet.',
  )

  res.json(toClinicSettings(row))
}
