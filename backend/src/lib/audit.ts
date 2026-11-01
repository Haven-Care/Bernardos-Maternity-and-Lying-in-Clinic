import type { Request } from 'express'
import { getSupabaseClient } from '../config/supabase.js'
import { loggableDbError } from './db.js'

/**
 * Every action the activity log records. Named `<subject>.<verb>`; the
 * database refuses anything else, so a typo cannot quietly create a new kind.
 */
export type AuditAction =
  | 'patient.list'
  | 'patient.view'
  | 'patient.create'
  | 'patient.update'
  | 'patient.export'
  | 'clinical_record.view'
  | 'clinical_record.create'
  | 'document.list'
  | 'document.upload'
  | 'document.open'
  | 'staff.create'
  | 'staff.status'
  | 'service.create'
  | 'service.update'
  | 'slot.create'
  | 'slot.update'
  | 'clinic.update'
  | 'hours.update'
  | 'settings.update'
  | 'consent.record'
  | 'privacy_request.create'
  | 'privacy_request.resolve'

/** Field names and counts. Never a value from a patient's record. */
export type AuditDetails = Record<string, string | number | boolean | string[] | null>

/**
 * Records who did what to whose data.
 *
 * Awaited, so the row is written before the response leaves: on Vercel a
 * function may be frozen the moment it answers. A failed write is logged loudly
 * rather than failing the request. Refusing a nurse a patient's allergies
 * because the log was briefly unreachable would be the worse harm, and the
 * error log shows exactly which entries are missing.
 */
export async function audit(
  req: Request,
  action: AuditAction,
  target: { entityId?: string | null; patientId?: string | null; details?: AuditDetails } = {},
): Promise<void> {
  const actor = req.staff
    ? { id: req.staff.userId, role: req.staff.role }
    : req.patient
      ? { id: req.patient.userId, role: 'patient' as const }
      : { id: null, role: 'system' as const }

  const { error } = await getSupabaseClient().from('audit_log').insert({
    actor_id: actor.id,
    actor_role: actor.role,
    action,
    entity_id: target.entityId ?? null,
    patient_id: target.patientId ?? null,
    request_id: req.requestId ?? null,
    details: target.details ?? {},
  })

  if (error) {
    console.error('Audit write failed', { action, requestId: req.requestId, ...loggableDbError(error) })
  }
}
