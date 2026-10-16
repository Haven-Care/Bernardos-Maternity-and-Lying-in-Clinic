import { apiFetch } from './client'

export interface ClinicalRecord {
  id: string
  patientId: string
  occurredAt: string
  title: string
  findings: string
  provider: string
}

export type ClinicalRecordInput = Omit<ClinicalRecord, 'id' | 'patientId'>

export async function list(patientId: string): Promise<ClinicalRecord[]> {
  const rows: ClinicalRecord[] = []
  const limit = 200
  for (;;) {
    const page = await apiFetch<ClinicalRecord[]>(
      `/patients/${patientId}/clinical-history?offset=${rows.length}&limit=${limit}`,
    )
    if (rows.length > 0 && page[0]?.id === rows[0].id) return rows
    rows.push(...page)
    if (page.length !== limit) return rows
  }
}

export async function create(patientId: string, input: ClinicalRecordInput): Promise<ClinicalRecord> {
  return apiFetch<ClinicalRecord>(`/patients/${patientId}/clinical-history`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
