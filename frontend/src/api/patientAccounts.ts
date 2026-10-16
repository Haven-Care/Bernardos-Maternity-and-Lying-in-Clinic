import type { PatientListRow } from '../types/patient'
import { patients } from '../mocks/patients'
import { mockDelay } from '../mocks/util'

// Explicit demo mobile registrations; patient records alone do not imply accounts.
// Replace this adapter with the mobile patient-account endpoint when connected.
const demoRegisteredPatientIds = new Set(['pat-1', 'pat-2'])

export async function list(): Promise<PatientListRow[]> {
  return mockDelay(patients.filter((patient) => demoRegisteredPatientIds.has(patient.id)).map((patient) => ({
    id: patient.id,
    patientCode: patient.patientCode,
    fullName: patient.fullName,
    contactNumber: patient.contactNumber,
    lastVisit: patient.lastVisit,
  })))
}