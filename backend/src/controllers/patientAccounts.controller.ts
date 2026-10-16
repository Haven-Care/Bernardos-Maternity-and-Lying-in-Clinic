import type { Request, Response } from 'express'
import { z } from 'zod'
import { getSupabaseClient } from '../config/supabase.js'
import { unwrapList } from '../lib/db.js'
import { parseQuery } from '../lib/validate.js'

const pageSchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(100),
})

/** Accounts are separate from clinical records; registration alone creates no patient record. */
export async function listPatientAccounts(req: Request, res: Response) {
  const { offset, limit } = parseQuery(pageSchema, req.query)
  const db = getSupabaseClient()
  const accounts = unwrapList(
    await db.from('patient_accounts')
      .select('id, full_name, email, contact_number, created_at')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1),
  )
  const records = accounts.length === 0 ? [] : unwrapList(
    await db.from('patient_list')
      .select('account_id, patient_code, last_visit')
      .in('account_id', accounts.map((account) => account.id)),
  )
  const recordByAccount = new Map(records.map((record) => [record.account_id, record]))

  res.json(accounts.map((account) => {
    const record = recordByAccount.get(account.id)
    return {
      id: account.id,
      fullName: account.full_name,
      email: account.email,
      contactNumber: account.contact_number,
      registeredAt: account.created_at,
      patientCode: record?.patient_code ?? null,
      lastVisit: record?.last_visit ?? null,
    }
  }))
}
