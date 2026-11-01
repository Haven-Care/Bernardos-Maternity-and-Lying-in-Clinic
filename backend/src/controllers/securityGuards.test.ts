import type { Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getClient, staff } = vi.hoisted(() => ({
  getClient: vi.fn(),
  staff: { findStaff: vi.fn(), countActiveAdministrators: vi.fn(), setStaffStatus: vi.fn() },
}))
vi.mock('../config/supabase.js', () => ({ getSupabaseClient: getClient }))
vi.mock('../services/staff.js', async (original) => ({ ...(await original()), ...staff }))

import { createDocument } from './patients.controller.js'
import { declineRescheduleRequest } from './rescheduleRequests.controller.js'
import { patchStaffStatus } from './system.controller.js'
import { cancelMyBooking } from './patientPortal.controller.js'

const patientId = 'a6e591be-05e4-4da9-8a7a-5a0af373b57a'
const issuedPath = `${patientId}/f04f7c0e-33a3-497e-83e3-f6090b4845a9-ultrasound.pdf`
const ids = { request: '0f8f2a39-6f4d-4b51-9a77-3c1f25d0f001', admin: '9d3c3c4e-5b0c-4a77-8a0e-2f7f0c0de002', me: '7a7a7a7a-1111-4222-8333-444455556666' }

function response() {
  const res = { status: vi.fn(), json: vi.fn() }
  res.status.mockReturnValue(res)
  return res as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> }
}

/** A chainable query whose terminal calls resolve in order. */
function query(...results: unknown[]) {
  const q: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const name of ['select', 'eq', 'update', 'insert', 'in']) q[name] = vi.fn(() => q)
  q.maybeSingle = vi.fn()
  q.single = vi.fn()
  for (const result of results) {
    q.maybeSingle.mockResolvedValueOnce(result)
    q.single.mockResolvedValueOnce(result)
  }
  return q
}

beforeEach(() => {
  getClient.mockReset()
  Object.values(staff).forEach((fn) => fn.mockReset())
})

describe('patient document uploads', () => {
  function setup(bytes: string, contentType = 'application/pdf', size = 2048) {
    const bucket = {
      info: vi.fn().mockResolvedValue({ data: { contentType, size }, error: null }),
      download: vi.fn().mockResolvedValue({ data: new Blob([bytes]), error: null }),
      remove: vi.fn().mockResolvedValue({ error: null }),
    }
    const insert = query({ data: { id: 'doc', patient_id: patientId, doc_type: 'lab_results', file_name: 'ultrasound.pdf', file_size: size, uploaded_at: '2026-11-02T00:00:00Z' }, error: null })
    getClient.mockReturnValue({ from: () => insert, storage: { from: () => bucket } })
    return { bucket, insert }
  }
  const request = (storagePath: string, fileSize = 1) =>
    ({ params: { id: patientId }, body: { docType: 'lab_results', fileName: 'ultrasound.pdf', fileSize, storagePath }, staff: { userId: ids.admin, fullName: 'Admin' } }) as unknown as Request

  it('accepts only paths this API issued for this patient', async () => {
    for (const path of [`other/${issuedPath}`, `${patientId}/../${issuedPath}`, `${patientId}/ultrasound.pdf`]) {
      const s = setup('%PDF-1.7')
      await expect(createDocument(request(path), response())).rejects.toThrow('does not belong to this patient')
      expect(s.bucket.info).not.toHaveBeenCalled()
    }
  })

  it('deletes and refuses a file whose bytes do not match its declared type', async () => {
    const s = setup('<svg xmlns="http://www.w3.org/2000/svg"><script>', 'application/pdf')
    await expect(createDocument(request(issuedPath), response())).rejects.toThrow('not a PDF')
    expect(s.bucket.remove).toHaveBeenCalledWith([issuedPath])
    expect(s.insert.insert).not.toHaveBeenCalled()
  })

  it('records the stored size, not the size the browser claimed', async () => {
    const s = setup('%PDF-1.7\n', 'application/pdf', 4096)
    const res = response()
    await createDocument(request(issuedPath, 9_999_999), res)
    expect(s.insert.insert).toHaveBeenCalledWith(expect.objectContaining({ file_size: 4096, storage_path: issuedPath }))
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('refuses objects over the bucket limit', async () => {
    setup('%PDF-1.7', 'application/pdf', 10_485_761)
    await expect(createDocument(request(issuedPath), response())).rejects.toThrow('up to 10 MB')
  })
})

describe('declining a reschedule request', () => {
  it('reports a conflict when someone else decided it first', async () => {
    const requests = query(
      { data: { id: ids.request, status: 'pending', appointments: {} }, error: null },
      { data: null, error: null },
    )
    getClient.mockReturnValue({ from: () => requests })
    const req = { params: { id: ids.request }, staff: { userId: ids.admin } } as unknown as Request

    await expect(declineRescheduleRequest(req, response())).rejects.toMatchObject({ status: 409 })
    expect(requests.eq).toHaveBeenCalledWith('status', 'pending')
  })
})

describe('deactivating staff', () => {
  const req = (id: string) => ({ params: { id }, body: { status: 'inactive' }, staff: { userId: ids.me } }) as unknown as Request

  it('keeps the last active administrator', async () => {
    staff.findStaff.mockResolvedValue({ id: ids.admin, role: 'administrator', status: 'active' })
    staff.countActiveAdministrators.mockResolvedValue(1)
    const res = response()

    await patchStaffStatus(req(ids.admin), res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(staff.setStaffStatus).not.toHaveBeenCalled()
  })

  it('allows it while another administrator remains', async () => {
    staff.findStaff.mockResolvedValue({ id: ids.admin, role: 'administrator', status: 'active' })
    staff.countActiveAdministrators.mockResolvedValue(2)
    staff.setStaffStatus.mockResolvedValue({ id: ids.admin, status: 'inactive' })

    await patchStaffStatus(req(ids.admin), response())

    expect(staff.setStaffStatus).toHaveBeenCalledWith(ids.admin, 'inactive')
  })
})

describe('patient self-cancellation', () => {
  const booking = {
    id: ids.request, reference_no: 'BR-1', patient_name: 'P', contact_number: '0', email: 'p@example.test', patient_id: patientId,
    service_id: 's', service_name: 'Check-up', scheduled_date: '2026-11-20', slot_time: '09:00', status: 'pending',
    reason_for_visit: '', submitted_at: '2026-11-02T00:00:00Z', account_id: ids.me,
  }

  it('cancels through the audited database function, as the signed-in account', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ...booking, status: 'cancelled' }, error: null })
    getClient.mockReturnValue({ from: () => query({ data: booking, error: null }), rpc })
    const res = response()

    await cancelMyBooking({ params: { id: booking.id }, patient: { userId: ids.me } } as unknown as Request, res)

    expect(rpc).toHaveBeenCalledWith('cancel_own_appointment', { p_booking_id: booking.id, p_account_id: ids.me })
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' }))
  })

  it('passes on the conflict when staff changed the visit first', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: 'HC409', message: 'This visit can now only be managed by clinic staff.' } })
    getClient.mockReturnValue({ from: () => query({ data: booking, error: null }), rpc })

    await expect(
      cancelMyBooking({ params: { id: booking.id }, patient: { userId: ids.me } } as unknown as Request, response()),
    ).rejects.toMatchObject({ status: 409 })
  })
})
