import type { Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getClient, audit } = vi.hoisted(() => ({ getClient: vi.fn(), audit: vi.fn() }))
vi.mock('../config/supabase.js', () => ({ getSupabaseClient: getClient }))
vi.mock('../lib/audit.js', () => ({ audit }))

import { PRIVACY_NOTICE_VERSION } from '../contract/privacy.js'
import {
  createMyPrivacyRequest,
  getMyConsent,
  listAuditLog,
  recordMyConsent,
  requireCurrentConsent,
  resolvePrivacyRequest,
} from './privacy.controller.js'

const me = '7a7a7a7a-1111-4222-8333-444455556666'

/** A query builder whose every call chains, and which resolves to `results` in turn when awaited. */
function chain(...results: unknown[]) {
  const q: Record<string, unknown> & { calls: string[] } = { calls: [] }
  for (const name of ['select', 'eq', 'is', 'in', 'order', 'range', 'limit', 'insert', 'upsert', 'update']) {
    q[name] = vi.fn((...args: unknown[]) => {
      q.calls.push(`${name}:${JSON.stringify(args[0] ?? null)}`)
      return q
    })
  }
  const next = () => (results.length > 1 ? results.shift() : results[0])
  q.single = vi.fn(async () => next())
  q.maybeSingle = vi.fn(async () => next())
  q.then = (resolve: (value: unknown) => void) => resolve(next())
  return q
}

function response() {
  const res = { status: vi.fn(), json: vi.fn() }
  res.status.mockReturnValue(res)
  return res as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> }
}

const asPatient = (signupConsentVersion: string | null = null, body: object = {}) =>
  ({ patient: { userId: me, signupConsentVersion }, body, params: {}, query: {} }) as unknown as Request

beforeEach(() => {
  getClient.mockReset()
  audit.mockReset().mockResolvedValue(undefined)
})

describe('consent to the privacy notice', () => {
  it('requires consent from an account that never agreed', async () => {
    getClient.mockReturnValue({ from: () => chain({ data: [], error: null }) })
    const res = response()
    await getMyConsent(asPatient(), res)
    expect(res.json).toHaveBeenCalledWith({ noticeVersion: PRIVACY_NOTICE_VERSION, consentedVersion: null, consentedAt: null, required: true })
  })

  it('turns the box ticked at sign-up into a consent record at first sign-in', async () => {
    const consents = chain(
      { data: [], error: null },
      { error: null },
      { data: [{ notice_version: PRIVACY_NOTICE_VERSION, consented_at: '2026-11-02T00:00:00Z' }], error: null },
    )
    getClient.mockReturnValue({ from: () => consents })
    const res = response()

    await getMyConsent(asPatient(PRIVACY_NOTICE_VERSION), res)

    expect(consents.upsert).toHaveBeenCalledWith(
      { account_id: me, notice_version: PRIVACY_NOTICE_VERSION, channel: 'sign_up' },
      { onConflict: 'account_id,notice_version', ignoreDuplicates: true },
    )
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ required: false, consentedVersion: PRIVACY_NOTICE_VERSION }))
    expect(audit).toHaveBeenCalledWith(expect.anything(), 'consent.record', { details: { noticeVersion: PRIVACY_NOTICE_VERSION, channel: 'sign_up' } })
  })

  it('asks again after the notice changes, without counting an old sign-up tick', async () => {
    getClient.mockReturnValue({ from: () => chain({ data: [{ notice_version: 'older', consented_at: '2026-01-01T00:00:00Z' }], error: null }) })
    const res = response()
    await getMyConsent(asPatient('older'), res)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ required: true, consentedVersion: 'older' }))
  })

  it('refuses agreement to a notice that is no longer in force', async () => {
    getClient.mockReturnValue({ from: () => chain({ data: [], error: null }) })
    await expect(recordMyConsent(asPatient(null, { noticeVersion: 'older' }), response())).rejects.toMatchObject({ status: 409 })
  })

  it('blocks booking with 428 until the patient agrees', async () => {
    getClient.mockReturnValue({ from: () => chain({ data: [], error: null }) })
    await expect(requireCurrentConsent(asPatient())).rejects.toMatchObject({ status: 428 })
  })
})

describe('privacy requests', () => {
  it('limits how many requests one account can leave open', async () => {
    getClient.mockReturnValue({ from: () => chain({ count: 5, error: null }) })
    await expect(createMyPrivacyRequest(asPatient(null, { kind: 'access', details: '' }), response())).rejects.toMatchObject({ status: 429 })
  })

  it('files the request and notifies the desk without naming the patient', async () => {
    const requests = chain({ count: 0, error: null }, { data: { id: 'r1', kind: 'deletion', details: '', submitted_at: 't', resolved_at: null, resolution_note: '' }, error: null })
    const notifications = chain({ error: null })
    getClient.mockReturnValue({ from: (table: string) => (table === 'notifications' ? notifications : requests) })
    const res = response()

    await createMyPrivacyRequest(asPatient(null, { kind: 'deletion', details: 'Please delete my account.' }), res)

    expect(res.status).toHaveBeenCalledWith(201)
    const message = (notifications.insert as ReturnType<typeof vi.fn>).mock.calls[0][0].message as string
    expect(message).toContain('deletion')
    expect(message).not.toContain(me)
  })

  it('reports a conflict when the request was already resolved', async () => {
    getClient.mockReturnValue({ from: () => chain({ data: null, error: null }) })
    const req = { params: { id: '0f8f2a39-6f4d-4b51-9a77-3c1f25d0f001' }, body: { resolutionNote: 'Sent by email.' }, staff: { userId: 'admin' } } as unknown as Request
    await expect(resolvePrivacyRequest(req, response())).rejects.toMatchObject({ status: 409 })
  })
})

describe('activity log', () => {
  it('names staff and patients from their current records, and leaves gone accounts unnamed', async () => {
    const rows = [
      { id: 2, occurred_at: 't2', actor_id: 'staff-1', actor_role: 'staff', action: 'patient.view', entity_id: 'p', patient_id: 'p', details: {} },
      { id: 1, occurred_at: 't1', actor_id: 'gone', actor_role: 'patient', action: 'consent.record', entity_id: null, patient_id: null, details: { channel: 'in_app' } },
    ]
    getClient.mockReturnValue({
      from: (table: string) => table === 'audit_log'
        ? chain({ data: rows, error: null })
        : table === 'profiles'
          ? chain({ data: [{ id: 'staff-1', full_name: 'Nurse Joy' }], error: null })
          : chain({ data: [], error: null }),
    })
    const res = response()

    await listAuditLog({ query: {} } as unknown as Request, res)

    const entries = res.json.mock.calls[0][0]
    expect(entries[0]).toMatchObject({ actorName: 'Nurse Joy', action: 'patient.view', patientId: 'p' })
    expect(entries[1]).toMatchObject({ actorName: null, actorRole: 'patient' })
  })

  it('rejects malformed action filters', async () => {
    await expect(listAuditLog({ query: { action: 'drop table' } } as unknown as Request, response())).rejects.toMatchObject({ status: 400 })
  })
})
