import type { Request, Response } from 'express'
import { z } from 'zod'
import { getSupabaseClient } from '../config/supabase.js'
import { unwrap, unwrapList } from '../lib/db.js'
import { parseBody } from '../lib/validate.js'
import { HttpError } from '../middleware/errorHandler.js'

const idSchema = z.string().uuid('Not a valid patient id.')
const recordSchema = z.object({
  occurredAt: z.string().datetime({ offset: true }),
  title: z.string().trim().min(1).max(200),
  findings: z.string().trim().min(1).max(10000),
  provider: z.string().trim().min(1).max(200),
})

function toRecord(row: {
  id: string
  patient_id: string
  occurred_at: string
  title: string
  findings: string
  provider: string
}) {
  return {
    id: row.id,
    patientId: row.patient_id,
    occurredAt: row.occurred_at,
    title: row.title,
    findings: row.findings,
    provider: row.provider,
  }
}

async function requirePatientRecord(patientId: string) {
  unwrap(
    await getSupabaseClient().from('patients').select('id').eq('id', patientId).maybeSingle(),
    'No such patient.',
  )
}

export async function listClinicalHistory(req: Request, res: Response) {
  const patientId = parseBody(idSchema, req.params.id)
  await requirePatientRecord(patientId)
  const rows = unwrapList(
    await getSupabaseClient().from('clinical_records')
      .select('id, patient_id, occurred_at, title, findings, provider')
      .eq('patient_id', patientId)
      .order('occurred_at', { ascending: false }),
  )
  res.json(rows.map(toRecord))
}

export async function createClinicalRecord(req: Request, res: Response) {
  const patientId = parseBody(idSchema, req.params.id)
  const input = parseBody(recordSchema, req.body)
  if (!req.staff) throw new HttpError(500, 'Staff route mounted without requireStaff.')
  await requirePatientRecord(patientId)

  const row = unwrap(
    await getSupabaseClient().from('clinical_records').insert({
      patient_id: patientId,
      occurred_at: input.occurredAt,
      title: input.title,
      findings: input.findings,
      provider: input.provider,
      created_by: req.staff.userId,
    }).select('id, patient_id, occurred_at, title, findings, provider').single(),
  )
  res.status(201).json(toRecord(row))
}
