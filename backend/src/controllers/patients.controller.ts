import { text, personName, emailAddress, phoneNumber, wholeNumber, recordedDate } from '../lib/inputValidation.js'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { getSupabaseClient } from '../config/supabase.js'
import { definedOnly, unwrap, unwrapList } from '../lib/db.js'
import { audit } from '../lib/audit.js'
import { sniffDocumentType } from '../lib/fileSignature.js'
import { isoDate, parseBody } from '../lib/validate.js'
import { HttpError } from '../middleware/errorHandler.js'
import {
  toPatient,
  toPatientDocument,
  toPatientListRow,
} from '../mappers/patient.js'
import { toBooking } from '../mappers/appointment.js'

const idSchema = z.string().uuid('Not a valid patient id.')

/**
 * A patient record.
 *
 * Only `fullName` is required. Everything else can be blank because a record is
 * materialised at the patient's first booking, which supplies a name, a number
 * and an email and nothing more — staff complete the clinical fields at the
 * visit. A form that demanded a blood type would make that impossible.
 */
const patientFields = z.object({
  fullName: personName(),
  dateOfBirth: recordedDate().nullable(),
  sex: z.enum(['male', 'female']).nullable(),
  civilStatus: z.enum(['single', 'married', 'widowed', 'separated']).nullable(),
  contactNumber: phoneNumber(),
  email: emailAddress().or(z.literal('')),
  address: text(1000),
  occupation: text(),
  bloodType: z
    .enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .nullable(),
  emergencyContactName: personName().or(z.literal('')),
  emergencyContactNumber: phoneNumber(),
  emergencyContactRelation: text(100),

  lastMenstrualPeriod: recordedDate().nullable(),
  expectedDeliveryDate: isoDate().refine((value) => value >= '1900-01-01', 'Choose a date from 1900 onward.').nullable(),
  gravida: wholeNumber().nullable(),
  para: wholeNumber().nullable(),
  attendingPhysician: personName().or(z.literal('')),
  allergies: text(2000),
  medicalConditions: text(2000),
  visitType: z.enum(['prenatal', 'delivery', 'postnatal']).nullable(),
})

type PatientFields = z.infer<typeof patientFields>
type PatientInput = Partial<PatientFields>

/**
 * What a new record holds for anything the form left out. Applied on create
 * only: a PATCH that omits a field must leave the stored value alone, not reset
 * it to blank — omitting `allergies` from an edit must never erase them.
 */
const CREATE_DEFAULTS: Omit<PatientFields, 'fullName'> = {
  dateOfBirth: null,
  sex: null,
  civilStatus: null,
  contactNumber: '',
  email: '',
  address: '',
  occupation: '',
  bloodType: null,
  emergencyContactName: '',
  emergencyContactNumber: '',
  emergencyContactRelation: '',
  lastMenstrualPeriod: null,
  expectedDeliveryDate: null,
  gravida: null,
  para: null,
  attendingPhysician: '',
  allergies: '',
  medicalConditions: '',
  visitType: null,
}

// Mirrors the table constraint. A woman cannot have given birth more times
// than she has been pregnant, and catching it here names the problem instead
// of returning a check violation. On a partial edit it can only be checked
// when both are sent; the table constraint covers the rest.
const paraWithinGravida = (v: PatientInput) =>
  v.gravida == null || v.para == null || v.para <= v.gravida

const PARA_ISSUE = { message: 'Para cannot be greater than gravida.', path: ['para'] }
const deliveryAfterPeriod = (value: PatientInput) => !value.lastMenstrualPeriod || !value.expectedDeliveryDate || value.expectedDeliveryDate >= value.lastMenstrualPeriod
const DELIVERY_ISSUE = { message: 'Expected delivery date cannot precede the last menstrual period.', path: ['expectedDeliveryDate'] }

const patientCreateSchema = patientFields
  .partial()
  .required({ fullName: true })
  .refine(paraWithinGravida, PARA_ISSUE)
  .refine(deliveryAfterPeriod, DELIVERY_ISSUE)

const patientPatchSchema = patientFields
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.')
  .refine(paraWithinGravida, PARA_ISSUE)
  .refine(deliveryAfterPeriod, DELIVERY_ISSUE)

function toRow(input: PatientFields) {
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

export async function listPatients(req: Request, res: Response) {
  const rows = unwrapList(
    await getSupabaseClient()
      .from('patient_list')
      .select('id, patient_code, full_name, contact_number, last_visit')
      .order('patient_code'),
  )

  await audit(req, 'patient.list', { details: { count: rows.length } })
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

  await audit(req, 'patient.view', { entityId: id, patientId: id })
  res.json(toPatient(row, await lastVisitOf(id)))
}

export async function createPatient(req: Request, res: Response) {
  const input = parseBody(patientCreateSchema, req.body)

  const row = unwrap(
    await getSupabaseClient()
      .from('patients')
      .insert(toRow({ ...CREATE_DEFAULTS, ...input }))
      .select('*')
      .single(),
  )

  await audit(req, 'patient.create', { entityId: row.id, patientId: row.id })

  // A record that has just been created cannot have a completed visit behind
  // it, so there is nothing to look up.
  res.status(201).json(toPatient(row, null))
}

export async function updatePatient(req: Request, res: Response) {
  const id = parseBody(idSchema, req.params.id)
  const input = parseBody(patientPatchSchema, req.body)

  if (['gravida', 'para', 'lastMenstrualPeriod', 'expectedDeliveryDate'].some((key) => key in input)) {
    const current = unwrap(await getSupabaseClient().from('patients').select('gravida, para, last_menstrual_period, expected_delivery_date').eq('id', id).maybeSingle(), 'No such patient.')
    const merged = { gravida: current.gravida, para: current.para, lastMenstrualPeriod: current.last_menstrual_period, expectedDeliveryDate: current.expected_delivery_date, ...input }
    if (!paraWithinGravida(merged)) throw new HttpError(400, PARA_ISSUE.message)
    if (!deliveryAfterPeriod(merged)) throw new HttpError(400, DELIVERY_ISSUE.message)
  }

  const row = unwrap(
    await getSupabaseClient()
      .from('patients')
      // The cast lets the partial body through the full mapper; the keys it
      // did not carry come out undefined and definedOnly drops them.
      .update(definedOnly(toRow(input as PatientFields)))
      .eq('id', id)
      .select('*')
      .maybeSingle(),
    'No such patient.',
  )

  // Which fields changed, never what they now say.
  await audit(req, 'patient.update', { entityId: id, patientId: id, details: { fields: Object.keys(input).sort() } })
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

  await audit(req, 'document.list', { patientId, details: { count: rows.length } })
  res.json(
    rows.map((row) =>
      toPatientDocument(row, row.profiles?.full_name ?? 'Unknown'),
    ),
  )
}

const uploadUrlSchema = z.object({
  fileName: text(255).min(1, 'A file name is required.'),
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

  if (error) {
    console.error('Signed upload URL failed', { message: error.message })
    throw new HttpError(502, 'Could not start the upload. Please try again.')
  }

  res.json({ path: data.path, token: data.token, signedUrl: data.signedUrl })
}

const MAX_DOCUMENT_BYTES = 10_485_760

const documentSchema = z.object({
  docType: z.enum(DOC_TYPES),
  fileName: text(255).min(1),
  // Still accepted for older clients, but never stored: the size recorded is
  // the one Storage reports for the object.
  fileSize: z.number().int().min(1).max(MAX_DOCUMENT_BYTES).optional(),
  storagePath: text(512).min(1),
})

// Exactly what createUploadUrl issues: `<patient>/<uuid>-<sanitised name>`.
const DOCUMENT_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[\w.-]{1,100}$/

/** Step three: record the upload against the patient. */
export async function createDocument(req: Request, res: Response) {
  const patientId = parseBody(idSchema, req.params.id)
  const input = parseBody(documentSchema, req.body)
  const staff = req.staff

  // The client supplies the path it was given, so confirm it is one this API
  // issued for this patient rather than trusting it to point anywhere.
  const fileName = input.storagePath.slice(patientId.length + 1)
  if (!input.storagePath.startsWith(`${patientId}/`) || !DOCUMENT_FILE.test(fileName)) {
    throw new HttpError(400, 'That file does not belong to this patient.')
  }

  // Check what was actually stored, not what the browser said it sent.
  const bucket = getSupabaseClient().storage.from('patient-documents')
  const { data: object, error: objectError } = await bucket.info(input.storagePath)
  if (objectError || !object) throw new HttpError(400, 'Upload the file before saving it.')
  if (!object.size || object.size > MAX_DOCUMENT_BYTES) {
    throw new HttpError(400, 'Choose a PDF or image up to 10 MB.')
  }

  const { data: stored, error: downloadError } = await bucket.download(input.storagePath)
  if (downloadError || !stored) {
    throw new HttpError(502, 'Could not check the uploaded file. Please try again.')
  }

  const sniffed = sniffDocumentType(new Uint8Array(await stored.slice(0, 16).arrayBuffer()))
  if (!sniffed || sniffed !== object.contentType) {
    // Not kept: a file that lied about its type has no place next to medical records.
    await bucket.remove([input.storagePath]).catch(() => undefined)
    throw new HttpError(400, 'That file is not a PDF, JPG, PNG, WebP or HEIC document.')
  }

  const row = unwrap(
    await getSupabaseClient()
      .from('patient_documents')
      .insert({
        patient_id: patientId,
        doc_type: input.docType,
        file_name: input.fileName,
        file_size: object.size,
        storage_path: input.storagePath,
        uploaded_by: staff?.userId ?? null,
      })
      .select('*')
      .single(),
  )

  await audit(req, 'document.upload', { entityId: row.id, patientId, details: { docType: input.docType } })
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
      .select('storage_path, patient_id, doc_type')
      .eq('id', id)
      .maybeSingle(),
    'No such document.',
  )

  const { data, error } = await getSupabaseClient()
    .storage.from('patient-documents')
    .createSignedUrl(doc.storage_path, 300)

  if (error) {
    console.error('Signed document URL failed', { message: error.message })
    throw new HttpError(502, 'Could not open the document. Please try again.')
  }

  await audit(req, 'document.open', { entityId: id, patientId: doc.patient_id, details: { docType: doc.doc_type } })
  res.json({ url: data.signedUrl })
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * GET /api/patients/:id/export
 *
 * Everything the clinic holds about one patient, as one file: how staff answer
 * an access or portability request under RA 10173. Document files are listed,
 * not embedded; each is opened through its own short-lived link, so the export
 * stays small and every file access is logged on its own.
 */
export async function exportPatient(req: Request, res: Response) {
  const id = parseBody(idSchema, req.params.id)
  const db = getSupabaseClient()

  const patient = unwrap(await db.from('patients').select('*').eq('id', id).maybeSingle(), 'No such patient.')

  const [appointments, records, documents, consents] = await Promise.all([
    db.from('appointments').select('*').eq('patient_id', id).order('scheduled_date').order('slot_time'),
    db.from('clinical_records')
      .select('id, occurred_at, title, findings, provider, created_at')
      .eq('patient_id', id)
      .order('occurred_at'),
    db.from('patient_documents')
      .select('id, doc_type, file_name, file_size, uploaded_at')
      .eq('patient_id', id)
      .order('uploaded_at'),
    patient.account_id
      ? db.from('patient_consents').select('notice_version, channel, consented_at').eq('account_id', patient.account_id).order('consented_at')
      : Promise.resolve({ data: [], error: null }),
  ])

  await audit(req, 'patient.export', { entityId: id, patientId: id })

  res.set('Content-Disposition', `attachment; filename="patient-${patient.patient_code}.json"`)
  res.json({
    format: 'havencare-patient-export-v1',
    exportedAt: new Date().toISOString(),
    patient: toPatient(patient, await lastVisitOf(id)),
    appointments: unwrapList(appointments).map(toBooking),
    clinicalRecords: unwrapList(records).map((row) => ({
      id: row.id,
      occurredAt: row.occurred_at,
      title: row.title,
      findings: row.findings,
      provider: row.provider,
      recordedAt: row.created_at,
    })),
    documents: unwrapList(documents).map((row) => ({
      id: row.id,
      docType: row.doc_type,
      fileName: row.file_name,
      fileSize: Number(row.file_size),
      uploadedAt: row.uploaded_at,
    })),
    consents: unwrapList(consents).map((row) => ({
      noticeVersion: row.notice_version,
      channel: row.channel,
      consentedAt: row.consented_at,
    })),
  })
}
