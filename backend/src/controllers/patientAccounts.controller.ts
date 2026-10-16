import type { Request, Response } from 'express'
import { getSupabaseClient } from '../config/supabase.js'
import { unwrapList } from '../lib/db.js'

/** Accounts are separate from clinical records; registration alone creates no patient record. */
export async function listPatientAccounts(_req: Request, res: Response) {
  const db = getSupabaseClient()
  const accounts = unwrapList(
    await db.from('patient_accounts')
      .select('id, full_name, email, contact_number, created_at')
      .order('created_at', { ascending: false }),
  )
  const records = unwrapList(
    await db.from('patient_list')
      .select('account_id, patient_code, last_visit')
      .not('account_id', 'is', null),
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
