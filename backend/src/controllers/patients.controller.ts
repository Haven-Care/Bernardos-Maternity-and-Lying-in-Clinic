import type { Request, Response } from 'express'
import { z } from 'zod'
import { getSupabaseClient } from '../config/supabase.js'
import { unwrap, unwrapList } from '../lib/db.js'
import { parseBody } from '../lib/validate.js'
import { HttpError } from '../middleware/errorHandler.js'
import {
  toPatient,
  toPatientDocument,
  toPatientListRow,
} from '../mappers/patient.js'

const DATE = /^\d{4}-\d{2}-\d{2}$/

const idSchema = z.string().uuid('Not a valid patient id.')

/**
 * A patient record.
 *
 * Only `fullName` is required. Everything else can be blank because a record is
 * materialised at the patient's first booking, which supplies a name, a number
 * and an email and nothing more — staff complete the clinical fields at the
 * visit. A form that demanded a blood type would make that impossible.
 */
const patientSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required.'),
  dateOfBirth: z.string().regex(DATE).nullable().default(null),
  sex: z.enum(['male', 'female']).nullable().default(null),
  civilStatus: z
    .enum(['single', 'married', 'widowed', 'separated'])
    .nullable()
    .default(null),
  contactNumber: z.string().trim().default(''),
  email: z.string().trim().default(''),
  address: z.string().trim().default(''),
  occupation: z.string().trim().default(''),
  bloodType: z
    .enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .nullable()
    .default(null),
  emergencyContactName: z.string().trim().default(''),
  emergencyContactNumber: z.string().trim().default(''),
  emergencyContactRelation: z.string().trim().default(''),

  lastMenstrualPeriod: z.string().regex(DATE).nullable().default(null),
  expectedDeliveryDate: z.string().regex(DATE).nullable().default(null),
  gravida: z.number().int().min(0).nullable().default(null),
  para: z.number().int().min(0).nullable().default(null),
  attendingPhysician: z.string().trim().default(''),
  allergies: z.string().trim().default(''),
  medicalConditions: z.string().trim().default(''),
  visitType: z
    .enum(['prenatal', 'delivery', 'postnatal'])
    .nullable()
    .default(null),
})
  // Mirrors the table constraint. A woman cannot have given birth more times
  // than she has been pregnant, and catching it here names the problem instead
  // of returning a check violation.
  .refine(
    (v) => v.gravida === null || v.para === null || v.para <= v.gravida,
    { message: 'Para cannot be greater than gravida.', path: ['para'] },
  )

function toRow(input: z.infer<typeof patientSchema>) {
  return {
    full_name: input.fullName,
    date_of_birth: input.dateOfBirth,
    sex: input.sex,
    civil_status: input.civilStatus,
    contact_number: input.contactNumber,
    email: input.email,
    address: input.address,
    occupation: input.occupation,
    blood_type: input.bloodType,
    emergency_contact_name: input.emergencyContactName,
    emergency_contact_number: input.emergencyContactNumber,
    emergency_contact_relation: input.emergencyContactRelation,
    last_menstrual_period: input.lastMenstrualPeriod,
    expected_delivery_date: input.expectedDeliveryDate,
    gravida: input.gravida,
    para: input.para,
    attending_physician: input.attendingPhysician,
    allergies: input.allergies,
    medical_conditions: input.medicalConditions,
    visit_type: input.visitType,
  }
}

/** `lastVisit` lives in the view, so a single record needs it looked up. */
async function lastVisitOf(id: string): Promise<string | null> {
  const { data } = await getSupabaseClient()
    .from('patient_list')
    .select('last_visit')
    .eq('id', id)
    .maybeSingle()

  return data?.last_visit ?? null
}

export async function listPatients(_req: Request, res: Response) {
  const rows = unwrapList(
    await getSupabaseClient()
      .from('patient_list')
      .select('id, patient_code, full_name, contact_number, last_visit')
      .order('patient_code'),
  )

  res.json(rows.map(toPatientListRow))
}

export async function getPatient(req: Request, res: Response) {
  const id = parseBody(idSchema, req.params.id)

  const row = unwrap(
    await getSupabaseClient()
      .from('patients')
      .select('*')
      .eq('id', id)
      .maybeSingle(),
    'No such patient.',
  )

  res.json(toPatient(row, await lastVisitOf(id)))
}

export async function createPatient(req: Request, res: Response) {
  const input = parseBody(patientSchema, req.body)

  const row = unwrap(
    await getSupabaseClient()
      .from('patients')
      .insert(toRow(input))
      .select('*')
      .single(),
  )

  // A record that has just been created cannot have a completed visit behind
  // it, so there is nothing to look up.
  res.status(201).json(toPatient(row, null))
}

export async function updatePatient(req: Request, res: Response) {
  const id = parseBody(idSchema, req.params.id)
  const input = parseBody(patientSchema, req.body)

  const row = unwrap(
    await getSupabaseClient()
      .from('patients')
      .update(toRow(input))
      .eq('id', id)
      .select('*')
      .maybeSingle(),
    'No such patient.',
  )

  res.json(toPatient(row, await lastVisitOf(id)))
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

const DOC_TYPES = [
  'valid_id',
  'lab_results',
  'ultrasound_report',
  'marriage_certificate',
  'previous_hospital_records',
] as const

export async function listDocuments(req: Request, res: Response) {
  const patientId = parseBody(idSchema, req.params.id)

  const rows = unwrapList(
    await getSupabaseClient()
      .from('patient_documents')
      .select('*, profiles(full_name)')
      .eq('patient_id', patientId)
      .order('uploaded_at', { ascending: false }),
  )

  res.json(
    rows.map((row) =>
      toPatientDocument(row, row.profiles?.full_name ?? 'Unknown'),
    ),
  )
}

const uploadUrlSchema = z.object({
  fileName: z.string().trim().min(1, 'A file name is required.'),
})

/**
 * POST /api/patients/:id/documents/upload-url
 *
 * Step one of three. Express issues a signed URL, the browser PUTs the file
 * straight to Storage, then posts the metadata back.
 *
 * The file does not travel through Express. Streaming multipart uploads of
 * scanned records through the API would mean buffering medical documents in the
 * application's memory and disk for no benefit — Storage can receive them
 * directly, and a signed URL is what makes that safe: it is valid for one path,
 * for a few minutes, and only staff can obtain one.
 */
export async function createUploadUrl(req: Request, res: Response) {
  const patientId = parseBody(idSchema, req.params.id)
  const { fileName } = parseBody(uploadUrlSchema, req.body)

  const exists = await getSupabaseClient()
    .from('patients')
    .select('id')
    .eq('id', patientId)
    .maybeSingle()

  if (!exists.data) throw new HttpError(404, 'No such patient.')

  // Namespaced by patient and prefixed with a random id, so two uploads of
  // "ultrasound.jpg" cannot collide and a path cannot be guessed from a
  // patient id alone.
  const safeName = fileName.replace(/[^\w.-]+/g, '_').slice(-100)
  const path = `${patientId}/${crypto.randomUUID()}-${safeName}`

  const { data, error } = await getSupabaseClient()
    .storage.from('patient-documents')
    .createSignedUploadUrl(path)

  if (error) throw new HttpError(502, `Could not start the upload: ${error.message}`)

  res.json({ path: data.path, token: data.token, signedUrl: data.signedUrl })
}

const documentSchema = z.object({
  docType: z.enum(DOC_TYPES),
  fileName: z.string().trim().min(1),
  fileSize: z.number().int().min(0),
  storagePath: z.string().trim().min(1),
})

/** Step three: record the upload against the patient. */
export async function createDocument(req: Request, res: Response) {
  const patientId = parseBody(idSchema, req.params.id)
  const input = parseBody(documentSchema, req.body)
  const staff = req.staff

  // The client supplies the path it was given, so confirm it is still one that
  // belongs to this patient rather than trusting it to point anywhere.
  if (!input.storagePath.startsWith(`${patientId}/`)) {
    throw new HttpError(400, 'That file does not belong to this patient.')
  }

  const row = unwrap(
    await getSupabaseClient()
      .from('patient_documents')
      .insert({
        patient_id: patientId,
        doc_type: input.docType,
        file_name: input.fileName,
        file_size: input.fileSize,
        storage_path: input.storagePath,
        uploaded_by: staff?.userId ?? null,
      })
      .select('*')
      .single(),
  )

  res.status(201).json(toPatientDocument(row, staff?.fullName ?? 'Unknown'))
}

/**
 * GET /api/documents/:id/url
 *
 * A link that works for five minutes and then does not.
 *
 * Long enough to click and open, short enough that a URL pasted into a chat or
 * left in browser history stops being a way into someone's medical records.
 */
export async function getDocumentUrl(req: Request, res: Response) {
  const id = parseBody(z.string().uuid('Not a valid document id.'), req.params.id)

  const doc = unwrap(
    await getSupabaseClient()
      .from('patient_documents')
      .select('storage_path')
      .eq('id', id)
      .maybeSingle(),
    'No such document.',
  )

  const { data, error } = await getSupabaseClient()
    .storage.from('patient-documents')
    .createSignedUrl(doc.storage_path, 300)

  if (error) throw new HttpError(502, `Could not create a link: ${error.message}`)

  res.json({ url: data.signedUrl })
}
