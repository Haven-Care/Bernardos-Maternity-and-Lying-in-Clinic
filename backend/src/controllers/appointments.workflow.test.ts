import type { Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const { getClient, rpc } = vi.hoisted(() => ({ getClient: vi.fn(), rpc: vi.fn() }))
vi.mock('../config/supabase.js', () => ({ getSupabaseClient: getClient }))
import { arriveBooking, completeBooking, confirmBooking, noShowBooking } from './appointments.controller.js'
const id = 'a6e591be-05e4-4da9-8a7a-5a0af373b57a'
const req = { params: { id }, staff: { userId: 'verified-staff' } } as unknown as Request
beforeEach(() => { vi.resetAllMocks(); getClient.mockReturnValue({ rpc }) })
describe('staff visit transitions', () => {
  it.each([[confirmBooking, 'confirmed'], [arriveBooking, 'arrived'], [completeBooking, 'completed'], [noShowBooking, 'no_show']] as const)('records %s using the guarded actor and atomic transition', async (handler, status) => {
    rpc.mockResolvedValue({ data: { id, status }, error: null })
    const json = vi.fn()
    await handler(req, { json } as unknown as Response)
    expect(rpc).toHaveBeenCalledWith('transition_appointment', { p_booking_id: id, p_next: status, p_actor: 'verified-staff' })
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ id, status }))
  })
  it('refuses to transition without verified staff context', async () => {
    await expect(arriveBooking({ params: { id } } as unknown as Request, {} as Response)).rejects.toMatchObject({ status: 403 })
    expect(rpc).not.toHaveBeenCalled()
  })
  it('surfaces a database transition conflict as 409', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'HC409', message: 'The appointment changed.' } })
    await expect(completeBooking(req, {} as Response)).rejects.toMatchObject({ status: 409, message: 'The appointment changed.' })
  })
})
