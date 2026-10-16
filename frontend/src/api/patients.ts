import type {
  Patient,
  PatientDocument,
  PatientDocumentType,
  PatientInput,
  PatientListRow,
} from '../types/patient'
import { apiFetch } from './client'

export async function listPatients(): Promise<PatientListRow[]> {
  return apiFetch<PatientListRow[]>('/patients')
}

export async function getPatient(id: string): Promise<Patient> {
  return apiFetch<Patient>(`/patients/${id}`)
}

export async function createPatient(input: PatientInput): Promise<Patient> {
  return apiFetch<Patient>('/patients', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updatePatient(
  id: string,
  input: PatientInput,
): Promise<Patient> {
  return apiFetch<Patient>(`/patients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function listDocuments(
  patientId: string,
): Promise<PatientDocument[]> {
  return apiFetch<PatientDocument[]>(`/patients/${patientId}/documents`)
}

/**
 * Attach a document to a patient record.
 *
 * Three steps, because the file never passes through our API:
 *
 *   1. ask Express for a signed upload URL
 *   2. PUT the bytes straight to Storage
 *   3. tell Express it landed, so the row exists
 *
 * The bucket is private and has no policies, so that signed URL is the only way
 * to write to it and it is valid for one path for a few minutes. Reads work the
 * same way in reverse — see `getDocumentUrl`. These are medical records; there
 * is no public link to any of them at any point.
 *
 * Step 2 failing leaves no database row, which is the right way round. The
 * opposite — a row pointing at a file that never arrived — would show staff a
 * document they can never open.
 */
export async function uploadDocument(
  patientId: string,
  docType: PatientDocumentType,
  file: File,
): Promise<PatientDocument> {
  const { signedUrl, path } = await apiFetch<{
    signedUrl: string
    path: string
    token: string
  }>(`/patients/${patientId}/documents/upload-url`, {
    method: 'POST',
    body: JSON.stringify({ fileName: file.name }),
  })

  const upload = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  })

  if (!upload.ok) {
    throw new Error('The file could not be uploaded. Please try again.')
  }

  return apiFetch<PatientDocument>(`/patients/${patientId}/documents`, {
    method: 'POST',
    body: JSON.stringify({
      docType,
      fileName: file.name,
      fileSize: file.size,
      storagePath: path,
    }),
  })
}

/**
 * A download link that works for five minutes and then does not.
 *
 * Long enough to click and open; short enough that a URL left in browser
 * history or pasted into a chat stops being a way into someone's records.
 */
export async function getDocumentUrl(documentId: string): Promise<string> {
  const { url } = await apiFetch<{ url: string }>(`/documents/${documentId}/url`)
  return url
}
