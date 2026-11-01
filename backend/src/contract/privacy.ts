// ---------------------------------------------------------------------------
// GENERATED — do not edit.
//
// Source: frontend/src/types/. Regenerate with `npm run sync:types`.
// Edit the frontend copy; it is the contract, and this is a mirror of it.
// ---------------------------------------------------------------------------

import type { DateTimeString } from './common.js'

/**
 * The privacy notice in force, shown at /privacy.
 *
 * Bump it in the same change that alters the notice in substance: every
 * patient is then asked to agree again before they can book. `draft` marks
 * text the clinic and its lawyer have not yet approved.
 */
export const PRIVACY_NOTICE_VERSION = '2026-11-draft-1'

/** Where a patient stands against the notice in force. */
export interface ConsentStatus {
  noticeVersion: string
  /** The version this account last agreed to, or null if it never has. */
  consentedVersion: string | null
  consentedAt: DateTimeString | null
  /** True until the account has agreed to `noticeVersion`. */
  required: boolean
}

export interface ConsentInput {
  noticeVersion: string
}

/** The rights RA 10173 gives a data subject that the clinic acts on by request. */
export type PrivacyRequestKind = 'access' | 'correction' | 'deletion' | 'objection'

export interface PrivacyRequest {
  id: string
  kind: PrivacyRequestKind
  details: string
  submittedAt: DateTimeString
  resolvedAt: DateTimeString | null
  resolutionNote: string
  /** Staff view only: who asked, so the request can be answered. */
  requester?: { fullName: string; email: string } | null
  /** Staff view only. */
  resolvedBy?: string | null
}

export interface PrivacyRequestInput {
  kind: PrivacyRequestKind
  details: string
}

export interface ResolvePrivacyRequestInput {
  resolutionNote: string
}

export type AuditActorRole = 'administrator' | 'staff' | 'patient' | 'system'

/** One line of the activity log an administrator reads in System Access. */
export interface AuditEntry {
  id: number
  occurredAt: DateTimeString
  actorRole: AuditActorRole
  /** Resolved from the profile or patient account; null once it no longer exists. */
  actorName: string | null
  /** e.g. `patient.view`, `document.open`, `settings.update`. */
  action: string
  entityId: string | null
  patientId: string | null
  /** Field names and counts only, never record values. */
  details: Record<string, unknown>
}
