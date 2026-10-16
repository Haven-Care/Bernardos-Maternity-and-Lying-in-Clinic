import { apiFetch } from './client'

export interface PatientAccountRow {
  id: string
  fullName: string
  email: string
  contactNumber: string
  registeredAt: string
  patientCode: string | null
  lastVisit: string | null
}

export async function list(): Promise<PatientAccountRow[]> {
  const rows: PatientAccountRow[] = []
  const limit = 100
  for (;;) {
    const page = await apiFetch<PatientAccountRow[]>(`/patient-accounts?offset=${rows.length}&limit=${limit}`)
    if (rows.length > 0 && page[0]?.id === rows[0].id) return rows
    rows.push(...page)
    if (page.length !== limit) return rows
  }
}
