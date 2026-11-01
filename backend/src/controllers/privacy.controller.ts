import type { Request, Response } from 'express'
import { z } from 'zod'
import { getSupabaseClient } from '../config/supabase.js'
import { audit } from '../lib/audit.js'
import { dbError, unwrapList } from '../lib/db.js'
import { text } from '../lib/inputValidation.js'
import { parseBody, parseQuery } from '../lib/validate.js'
import { HttpError } from '../middleware/errorHandler.js'
import {
  PRIVACY_NOTICE_VERSION,
  type AuditEntry,
  type ConsentStatus,
  type PrivacyRequest,
} from '../contract/privacy.js'

/**
 * RA 10173 (Data Privacy Act) workflows: consent to the privacy notice,
 * data-subject requests, and the activity log administrators read.
 *
 * The clinic is the personal information controller; it decides what these
 * records say. This code only makes sure they are kept, and kept honestly.
 */

function patient(req: Request) {
  if (!req.patient) throw new HttpError(500, 'Patient route mounted without requirePatient')
  return req.patient
}

// --- Consent ------------------------------------------------------------------

async function insertConsent(req: Request, channel: 'sign_up' | 'in_app') {
  const me = patient(req)
  const { error } = await getSupabaseClient()
    .from('patient_consents')
    // Agreeing twice to the same notice is not an error, and not a second record.
    .upsert(
      { account_id: me.userId, notice_version: PRIVACY_NOTICE_VERSION, channel },
      { onConflict: 'account_id,notice_version', ignoreDuplicates: true },
    )
  if (error) throw dbError(error)
  await audit(req, 'consent.record', { details: { noticeVersion: PRIVACY_NOTICE_VERSION, channel } })
}

/**
 * Where this patient stands against the notice in force.
 *
 * A box ticked on the sign-up form for the current notice becomes a consent
 * record here, the first time the confirmed account signs in. That is the first
 * moment the clinic can attribute it to a verified account, and it spares the
 * patient being asked twice.
 */
export async function consentStatus(req: Request): Promise<ConsentStatus> {
  const me = patient(req)
  const db = getSupabaseClient()

  const read = async () => {
    const { data, error } = await db
      .from('patient_consents')
      .select('notice_version, consented_at')
      .eq('account_id', me.userId)
      .order('consented_at', { ascending: false })
    if (error) throw dbError(error)
    return data
  }

  let rows = await read()
  if (!rows.some((row) => row.notice_version === PRIVACY_NOTICE_VERSION) && me.signupConsentVersion === PRIVACY_NOTICE_VERSION) {
    await insertConsent(req, 'sign_up')
    rows = await read()
  }

  const current = rows.find((row) => row.notice_version === PRIVACY_NOTICE_VERSION)
  const latest = current ?? rows[0]
  return {
    noticeVersion: PRIVACY_NOTICE_VERSION,
    consentedVersion: latest?.notice_version ?? null,
    consentedAt: latest?.consented_at ?? null,
    required: !current,
  }
}

/** For handlers that collect health information: refuses until the patient has agreed. */
export async function requireCurrentConsent(req: Request) {
  if ((await consentStatus(req)).required) {
    throw new HttpError(428, 'Please read and accept the privacy notice before booking.')
  }
}

export async function getMyConsent(req: Request, res: Response) {
  res.json(await consentStatus(req))
}

const consentSchema = z.object({ noticeVersion: z.string().min(1).max(64) })

export async function recordMyConsent(req: Request, res: Response) {
  const { noticeVersion } = parseBody(consentSchema, req.body)

  // The patient must have been shown the notice in force, not an older page
  // left open in another tab.
  if (noticeVersion !== PRIVACY_NOTICE_VERSION) {
    throw new HttpError(409, 'The privacy notice has changed. Please read the current version.')
  }

  await insertConsent(req, 'in_app')
  res.json(await consentStatus(req))
}

// --- Privacy requests -----------------------------------------------------------

const KINDS = ['access', 'correction', 'deletion', 'objection'] as const
const KIND_LABEL: Record<(typeof KINDS)[number], string> = {
  access: 'a copy of their records',
  correction: 'a correction',
  deletion: 'deletion',
  objection: 'to object to processing',
}
// Enough for any genuine need; a script filing hundreds would bury the real ones.
const MAX_OPEN_PER_ACCOUNT = 5

type RequestRow = {
  id: string
  kind: string
  details: string
  submitted_at: string
  resolved_at: string | null
  resolution_note: string
}

function toRequest(row: RequestRow): PrivacyRequest {
  return {
    id: row.id,
    kind: row.kind as PrivacyRequest['kind'],
    details: row.details,
    submittedAt: row.submitted_at,
    resolvedAt: row.resolved_at,
    resolutionNote: row.resolution_note,
  }
}

export async function listMyPrivacyRequests(req: Request, res: Response) {
  const me = patient(req)
  const rows = unwrapList(
    await getSupabaseClient()
      .from('privacy_requests')
      .select('id, kind, details, submitted_at, resolved_at, resolution_note')
      .eq('account_id', me.userId)
      .order('submitted_at', { ascending: false }),
  )
  res.json(rows.map(toRequest))
}

const requestSchema = z.object({
  kind: z.enum(KINDS),
  details: text(2000).default(''),
})

export async function createMyPrivacyRequest(req: Request, res: Response) {
  const me = patient(req)
  const input = parseBody(requestSchema, req.body)
  const db = getSupabaseClient()

  const { count, error: countError } = await db
    .from('privacy_requests')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', me.userId)
    .is('resolved_at', null)
  if (countError) throw dbError(countError)
  if ((count ?? 0) >= MAX_OPEN_PER_ACCOUNT) {
    throw new HttpError(429, 'You already have several open requests. The clinic will answer those first.')
  }

  const { data: row, error } = await db
    .from('privacy_requests')
    .insert({ account_id: me.userId, kind: input.kind, details: input.details })
    .select('id, kind, details, submitted_at, resolved_at, resolution_note')
    .single()
  if (error) throw dbError(error)

  // Clinic-wide notification, so whoever is at the desk knows one is waiting.
  // No name: the request itself is personal, and the bell is seen by all staff.
  await db.from('notifications').insert({
    message: `A patient asked for ${KIND_LABEL[input.kind]} under the Data Privacy Act.`,
    href: '/admin/system?tab=privacy',
  })

  await audit(req, 'privacy_request.create', { entityId: row.id, details: { kind: input.kind } })
  res.status(201).json(toRequest(row))
}

const requestListQuery = z.object({
  status: z.enum(['open', 'all']).default('open'),
})

/** Administrators: the queue of requests to answer. */
export async function listPrivacyRequests(req: Request, res: Response) {
  const { status } = parseQuery(requestListQuery, req.query)

  let query = getSupabaseClient()
    .from('privacy_requests')
    .select('id, kind, details, submitted_at, resolved_at, resolution_note, patient_accounts(full_name, email), profiles(full_name)')
    .order('submitted_at', { ascending: true })
    .limit(500)
  if (status === 'open') query = query.is('resolved_at', null)

  const rows = unwrapList(await query)
  res.json(rows.map((row) => ({
    ...toRequest(row),
    requester: row.patient_accounts ? { fullName: row.patient_accounts.full_name, email: row.patient_accounts.email } : null,
    resolvedBy: row.profiles?.full_name ?? null,
  })))
}

const resolveSchema = z.object({ resolutionNote: text(2000).min(1, 'Record what was done.') })
const requestIdSchema = z.string().uuid('Not a valid request id.')

export async function resolvePrivacyRequest(req: Request, res: Response) {
  const id = parseBody(requestIdSchema, req.params.id)
  const { resolutionNote } = parseBody(resolveSchema, req.body)
  if (!req.staff) throw new HttpError(500, 'Staff route mounted without requireStaff')

  const { data: row, error } = await getSupabaseClient()
    .from('privacy_requests')
    .update({ resolved_at: new Date().toISOString(), resolved_by: req.staff.userId, resolution_note: resolutionNote })
    .eq('id', id)
    .is('resolved_at', null)
    .select('id, kind, details, submitted_at, resolved_at, resolution_note')
    .maybeSingle()
  if (error) throw dbError(error)
  if (!row) throw new HttpError(409, 'That request is already resolved, or does not exist.')

  await audit(req, 'privacy_request.resolve', { entityId: id, details: { kind: row.kind } })
  res.json(toRequest(row))
}

// --- Activity log ------------------------------------------------------------------

const auditQuery = z.object({
  patientId: z.string().uuid().optional(),
  action: z.string().regex(/^[a-z_]+\.[a-z_]+$/, 'Not a known action.').optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(100),
})

/** Administrators: who viewed or changed what, newest first. */
export async function listAuditLog(req: Request, res: Response) {
  const { patientId, action, offset, limit } = parseQuery(auditQuery, req.query)
  const db = getSupabaseClient()

  let query = db
    .from('audit_log')
    .select('*')
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)
  if (patientId) query = query.eq('patient_id', patientId)
  if (action) query = query.eq('action', action)
  const rows = unwrapList(await query)

  // The log keeps ids, not names, so it outlives accounts. Names are looked up
  // now and are simply absent for an account that no longer exists.
  const actorIds = [...new Set(rows.map((row) => row.actor_id).filter((id): id is string => Boolean(id)))]
  const names = new Map<string, string>()
  if (actorIds.length > 0) {
    const [staff, patients] = await Promise.all([
      db.from('profiles').select('id, full_name').in('id', actorIds),
      db.from('patient_accounts').select('id, full_name').in('id', actorIds),
    ])
    for (const row of [...unwrapList(staff), ...unwrapList(patients)]) names.set(row.id, row.full_name)
  }

  const entries: AuditEntry[] = rows.map((row) => ({
    id: row.id,
    occurredAt: row.occurred_at,
    actorRole: row.actor_role as AuditEntry['actorRole'],
    actorName: row.actor_id ? names.get(row.actor_id) ?? null : null,
    action: row.action,
    entityId: row.entity_id,
    patientId: row.patient_id,
    details: (row.details ?? {}) as Record<string, unknown>,
  }))
  res.json(entries)
}
