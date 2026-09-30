import type { DateTimeString } from './common'

/**
 * A patient's login account.
 *
 * **Not the same thing as a `Patient`.** That is the clinical record — gravida,
 * para, last menstrual period, attending physician — and nobody fills it in on
 * a phone at sign-up. This holds only what someone can reasonably supply
 * themselves: who they are and how to reach them.
 *
 * The clinical record is created at the patient's *first booking*, from the
 * name, number and email given here, and staff complete it at the visit. An
 * account that never books leaves no empty row in Patient Records.
 */
export interface PatientAccount {
  id: string
  fullName: string
  contactNumber: string
  email: string

  /** Mobile screen U43, Notification Setting. Email only; SMS is out of scope. */
  emailNotifications: boolean

  createdAt: DateTimeString
}

/** The public sign-up form. */
export interface PatientSignupInput {
  fullName: string
  email: string
  contactNumber: string
  password: string
}

export interface PatientProfileInput {
  fullName: string
  contactNumber: string
}
