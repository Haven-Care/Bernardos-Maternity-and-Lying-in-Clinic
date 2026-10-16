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
  return apiFetch<PatientAccountRow[]>('/patient-accounts')
}
