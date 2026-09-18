import type { DateString, DateTimeString } from './common'

export type Sex = 'male' | 'female'

export type CivilStatus = 'single' | 'married' | 'widowed' | 'separated'

export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-'

/** The Maternity & Medical Info visit-type select. */
export type VisitType = 'prenatal' | 'delivery' | 'postnatal'

/** Upload rows in the Required Documents section. */
export type PatientDocumentType =
  | 'valid_id'
  | 'lab_results'
  | 'ultrasound_report'
  | 'marriage_certificate'
  | 'previous_hospital_records'

/**
 * A patient record. Patient Records → New Patient Record.
 *
 * Grouped to match the form's two column sections. Several fields were read at
 * the limit of legible resolution in the prototype — check these against the
 * Figma before the backend phase freezes the schema:
 * `occupation`, `emergencyContactRelation`, `gravida`, `para`.
 */
export interface Patient {
  id: string
  /** e.g. `P-108`. */
  patientCode: string

  // Personal Information
  fullName: string
  dateOfBirth: DateString
  sex: Sex
  civilStatus: CivilStatus
  contactNumber: string
  email: string
  address: string
  occupation: string
  bloodType: BloodType | null
  emergencyContactName: string
  emergencyContactNumber: string
  emergencyContactRelation: string

  // Maternity & Medical Info
  /** Last menstrual period. */
  lastMenstrualPeriod: DateString | null
  /** Expected delivery date. */
  expectedDeliveryDate: DateString | null
  /** Number of pregnancies. */
  gravida: number | null
  /** Number of births carried to viability. */
  para: number | null
  attendingPhysician: string
  allergies: string
  medicalConditions: string
  visitType: VisitType | null

  /** Derived from the most recent completed appointment. */
  lastVisit: DateString | null
  createdAt: DateTimeString
}

/**
 * An uploaded document attached to a patient record.
 *
 * These are medical records. When the backend lands they go in a **private**
 * Supabase Storage bucket, served via signed URLs only — never a public bucket.
 */
export interface PatientDocument {
  id: string
  patientId: string
  docType: PatientDocumentType
  fileName: string
  /** Bytes, for display. */
  fileSize: number
  uploadedAt: DateTimeString
  uploadedBy: string
}

/** A row of the Patient Records table. */
export interface PatientListRow {
  id: string
  patientCode: string
  fullName: string
  contactNumber: string
  lastVisit: DateString | null
}

export type PatientInput = Omit<
  Patient,
  'id' | 'patientCode' | 'lastVisit' | 'createdAt'
>
