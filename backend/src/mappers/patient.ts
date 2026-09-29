import type { Database } from '../db/types.js'
import type {
  Patient,
  PatientDocument,
  PatientListRow,
} from '../contract/patient.js'

type PatientRow = Database['public']['Tables']['patients']['Row']
type PatientListViewRow = Database['public']['Views']['patient_list']['Row']
type DocumentRow = Database['public']['Tables']['patient_documents']['Row']

/**
 * The clinical record.
 *
 * `lastVisit` is not on the table — it is derived from the most recent
 * completed appointment and comes from the `patient_list` view, so it is passed
 * in rather than read off the row.
 */
export function toPatient(row: PatientRow, lastVisit: string | null): Patient {
  return {
    id: row.id,
    patientCode: row.patient_code,

    fullName: row.full_name,
    dateOfBirth: row.date_of_birth,
    sex: row.sex,
    civilStatus: row.civil_status,
    contactNumber: row.contact_number,
    email: row.email,
    address: row.address,
    occupation: row.occupation,
    bloodType: row.blood_type,
    emergencyContactName: row.emergency_contact_name,
    emergencyContactNumber: row.emergency_contact_number,
    emergencyContactRelation: row.emergency_contact_relation,

    lastMenstrualPeriod: row.last_menstrual_period,
    expectedDeliveryDate: row.expected_delivery_date,
    gravida: row.gravida,
    para: row.para,
    attendingPhysician: row.attending_physician,
    allergies: row.allergies,
    medicalConditions: row.medical_conditions,
    visitType: row.visit_type,

    lastVisit,
    createdAt: row.created_at,
  }
}

/**
 * A row of the Patient Records table.
 *
 * Typed as the columns it reads rather than the whole view row, because the
 * query selects five of them and a wider parameter would not accept the
 * narrower result.
 *
 * Every column of a view is nullable in the generated types — Postgres cannot
 * promise otherwise — so the ones the table depends on are asserted here, at
 * the single point where view rows enter the application.
 */
type PatientListPick = Pick<
  PatientListViewRow,
  'id' | 'patient_code' | 'full_name' | 'contact_number' | 'last_visit'
>

export function toPatientListRow(row: PatientListPick): PatientListRow {
  return {
    id: row.id!,
    patientCode: row.patient_code!,
    fullName: row.full_name!,
    contactNumber: row.contact_number!,
    lastVisit: row.last_visit,
  }
}

export function toPatientDocument(
  row: DocumentRow,
  uploadedBy: string,
): PatientDocument {
  return {
    id: row.id,
    patientId: row.patient_id,
    docType: row.doc_type,
    fileName: row.file_name,
    fileSize: Number(row.file_size),
    uploadedAt: row.uploaded_at,
    // The contract carries a name, not an id — the table shows "uploaded by
    // Hannah Puerta". Resolved by the caller, which already has the join.
    uploadedBy,
  }
}
