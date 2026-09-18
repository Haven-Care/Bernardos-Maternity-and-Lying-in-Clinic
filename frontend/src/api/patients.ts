import type {
  Patient,
  PatientDocument,
  PatientDocumentType,
  PatientInput,
  PatientListRow,
} from '../types/patient'
import { patientDocuments, patients } from '../mocks/patients'
import { mockDelay, mockReject, uid } from '../mocks/util'
// import { apiFetch } from './client'

export async function listPatients(): Promise<PatientListRow[]> {
  // BACKEND: return apiFetch<PatientListRow[]>('/patients')
  const rows = patients.map((p) => ({
    id: p.id,
    patientCode: p.patientCode,
    fullName: p.fullName,
    contactNumber: p.contactNumber,
    lastVisit: p.lastVisit,
  }))
  return mockDelay(rows)
}

export async function getPatient(id: string): Promise<Patient> {
  // BACKEND: return apiFetch<Patient>(`/patients/${id}`)
  const p = patients.find((x) => x.id === id)
  if (!p) return mockReject(`Patient not found: ${id}`)
  return mockDelay(p)
}

export async function createPatient(input: PatientInput): Promise<Patient> {
  // BACKEND: return apiFetch<Patient>('/patients', { method: 'POST', body: JSON.stringify(input) })
  const created: Patient = {
    ...input,
    id: uid('pat'),
    patientCode: `P-${108 + patients.length}`,
    lastVisit: null,
    createdAt: new Date().toISOString(),
  }
  patients.push(created)
  return mockDelay(created)
}

export async function updatePatient(
  id: string,
  input: PatientInput,
): Promise<Patient> {
  // BACKEND: return apiFetch<Patient>(`/patients/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  const p = patients.find((x) => x.id === id)
  if (!p) return mockReject(`Patient not found: ${id}`)
  Object.assign(p, input)
  return mockDelay(p)
}

export async function listDocuments(
  patientId: string,
): Promise<PatientDocument[]> {
  // BACKEND: return apiFetch<PatientDocument[]>(`/patients/${patientId}/documents`)
  return mockDelay(patientDocuments.filter((d) => d.patientId === patientId))
}

/**
 * Attach a document to a patient record.
 *
 * The real implementation uploads to a **private** Supabase Storage bucket and
 * stores only the path — these are medical records, so they are never served
 * from a public bucket and reads go through a signed URL.
 */
export async function uploadDocument(
  patientId: string,
  docType: PatientDocumentType,
  file: File,
): Promise<PatientDocument> {
  // BACKEND: upload to the private bucket via supabase.storage, then POST the
  // BACKEND: returned path to `/patients/${patientId}/documents`
  const created: PatientDocument = {
    id: uid('doc'),
    patientId,
    docType,
    fileName: file.name,
    fileSize: file.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy: 'Hannah Puerta',
  }
  patientDocuments.push(created)
  return mockDelay(created)
}

/** Time-limited download link. Never a public URL. */
export async function getDocumentUrl(documentId: string): Promise<string> {
  // BACKEND: return apiFetch<{ url: string }>(`/documents/${documentId}/url`).then(r => r.url)
  const doc = patientDocuments.find((d) => d.id === documentId)
  if (!doc) return mockReject(`Document not found: ${documentId}`)
  return mockDelay(`#mock-download/${doc.fileName}`)
}
