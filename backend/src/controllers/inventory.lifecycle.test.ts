import type { Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const { getClient, rpc } = vi.hoisted(() => ({ getClient: vi.fn(), rpc: vi.fn() }))
vi.mock('../config/supabase.js', () => ({ getSupabaseClient: getClient }))
import { createMedicine, moveStock, quarantineBatch, receiveStock, reverseMovement } from './inventory.controller.js'
const id = 'a6e591be-05e4-4da9-8a7a-5a0af373b57a'
const batch = { id, medicine_id: id, batch_no: 'B-TEST', manufacturer_lot: 'LOT-A', quantity: 5, expires_at: '2099-01-01', received_at: '2026-10-28', quarantined: false, quarantine_reason: null, closed_reason: null }
function req(body: object, staff = true) { return { params: { id }, body, ...(staff ? { staff: { userId: 'verified-staff' } } : {}) } as unknown as Request }
function response() { const json = vi.fn(); return { json, status: vi.fn().mockReturnValue({ json }) } as unknown as Response }
beforeEach(() => { vi.resetAllMocks(); getClient.mockReturnValue({ rpc }); rpc.mockResolvedValue({ data: batch, error: null }) })
describe('inventory lifecycle boundary', () => {
  it('records a receipt against the authenticated actor rather than an injected body actor', async () => {
    await receiveStock(req({ medicineId: id, manufacturerLot: 'LOT-A', quantity: 5, expiresAt: '2099-01-01', note: 'Delivery DR-01', actor: 'forged-user' }), response())
    expect(rpc).toHaveBeenCalledWith('receive_inventory_stock', expect.objectContaining({ p_actor: 'verified-staff', p_manufacturer_lot: 'LOT-A' }))
  })
  it('does not issue an inventory write without verified staff context', async () => {
    await expect(receiveStock(req({ medicineId: id, quantity: 5, expiresAt: '2099-01-01', note: 'Delivery' }, false), response())).rejects.toMatchObject({ status: 500 })
    expect(rpc).not.toHaveBeenCalled()
  })
  it.each(['dispensed', 'disposed'])('rejects negative %s quantities before any stock write', async (reason) => {
    await expect(moveStock(req({ quantity: -1, reason, note: 'Reference' }), response())).rejects.toMatchObject({ status: 400 })
    expect(rpc).not.toHaveBeenCalled()
  })
  it('allows a signed count correction with an explanation', async () => {
    await moveStock(req({ quantity: -2, reason: 'adjustment', note: 'Verified recount' }), response())
    expect(rpc).toHaveBeenCalledWith('move_inventory_stock', expect.objectContaining({ p_quantity: -2, p_reason: 'adjustment', p_actor: 'verified-staff' }))
  })
  it('rejects an unexplained correction', async () => {
    await expect(moveStock(req({ quantity: 2, reason: 'adjustment', note: ' ' }), response())).rejects.toMatchObject({ status: 400 })
    expect(rpc).not.toHaveBeenCalled()
  })
  it('changes quarantine through the availability RPC without writing a quantity', async () => {
    await quarantineBatch(req({ quarantined: true, note: 'Damaged packaging' }), response())
    expect(rpc).toHaveBeenCalledWith('set_inventory_quarantine', { p_batch_id: id, p_quarantined: true, p_note: 'Damaged packaging', p_actor: 'verified-staff' })
  })
  it('returns a reversal conflict as an actionable 409', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'HC409', message: 'This movement has already been reversed.' } })
    await expect(reverseMovement(req({ note: 'Correct entry' }), response())).rejects.toMatchObject({ status: 409, message: 'This movement has already been reversed.' })
  })
  it.each(['aaa', '1e3', 1.5, 0, 2_147_483_648, null])('rejects malformed receipt quantity %s before any database write', async (quantity) => {
    await expect(receiveStock(req({ medicineId: id, manufacturerLot: 'LOT-A', quantity, expiresAt: '2099-01-01', note: 'Delivery DR-01' }), response())).rejects.toMatchObject({ status: 400 })
    expect(rpc).not.toHaveBeenCalled()
  })
  it('rejects whitespace-only and excessive movement reasons', async () => {
    for (const note of ['  ', 'x'.repeat(2001)]) {
      await expect(moveStock(req({ quantity: 1, reason: 'disposed', note }), response())).rejects.toMatchObject({ status: 400 })
    }
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each([
    { genericName: ' ' }, { dosage: '' }, { unitCost: -1 }, { sellingPrice: 1.999 },
    { reorderLevel: 1.5 }, { reorderLevel: 20, targetStockLevel: 10 }, { brandName: 'x'.repeat(201) },
  ])('rejects invalid medicine metadata %j before creating a record', async (invalid) => {
    await expect(createMedicine(req({ genericName: 'Test Medicine', dosageForm: 'Tablet', dosage: '100mg', ...invalid }), response())).rejects.toMatchObject({ status: 400 })
    expect(getClient).not.toHaveBeenCalled()
  })

})
