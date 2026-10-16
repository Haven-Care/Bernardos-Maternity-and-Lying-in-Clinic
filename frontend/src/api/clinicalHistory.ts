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
  return apiFetch<ClinicalRecord[]>(`/patients/${patientId}/clinical-history`)
}

export async function create(patientId: string, input: ClinicalRecordInput): Promise<ClinicalRecord> {
  return apiFetch<ClinicalRecord>(`/patients/${patientId}/clinical-history`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
