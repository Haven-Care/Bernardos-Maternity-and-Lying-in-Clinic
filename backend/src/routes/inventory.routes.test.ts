import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { getSupabaseClient } from '../config/supabase.js'
import {
  ADMIN_EMAIL,
  STAFF_PASSWORD,
  signIn,
  signUpPatient,
  stackIsUp,
  uniqueEmail,
} from '../test/stack.js'

const app = createApp()
const up = await stackIsUp()

describe.skipIf(!up)('inventory', () => {
  let staff: string
  let patientToken: string
  const auth = () => ({ Authorization: `Bearer ${staff}` })

  beforeAll(async () => {
    staff = await signIn(ADMIN_EMAIL, STAFF_PASSWORD)
    const p = await signUpPatient(uniqueEmail('inv'), 'Sup3rSecret!', 'Patient')
    patientToken = p.token
  })

  describe('reads', () => {
    it('returns the contract shape with derived stock', async () => {
      const res = await request(app)
        .get('/api/inventory/medicines')
        .set(auth())
        .expect(200)

      const para = res.body.find(
        (m: { genericName: string }) => m.genericName === 'Paracetamol',
      )

      // 120 + 580 across two batches — the sum is the point of the batch model.
      expect(para).toMatchObject({
        genericName: 'Paracetamol',
        qtyOnHand: 700,
        reorderLevel: 200,
        stockStatus: 'good',
        unitCost: expect.any(Number),
      })
      expect(para.nearestExpiry).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('flags exactly the medicines below their reorder level', async () => {
      const res = await request(app)
        .get('/api/inventory/low-stock')
        .set(auth())
        .expect(200)

      const names = res.body.map((r: { genericName: string }) => r.genericName)

      // Ferrous Sulfate 20/70 and Oxytocin 12/30.
      expect(names.sort()).toEqual(['Ferrous Sulfate', 'Oxytocin'])
      expect(res.body[0]).toEqual({
        medicineId: expect.any(String),
        genericName: expect.any(String),
        qtyOnHand: expect.any(Number),
        reorderLevel: expect.any(Number),
        unit: expect.any(String),
      })
    })

    it('reports stat tiles that agree with the tabs beneath them', async () => {
      // Asserted as consistency rather than fixed numbers. The counts here and
      // the rows in each tab come from the same view, and the failure that
      // actually matters is them disagreeing — a dashboard claiming three low
      // medicines above a tab listing two. Fixed totals would also break on
      // every run, because these tests add medicines of their own.
      const [stats, medicines, low, expiring] = await Promise.all([
        request(app).get('/api/inventory/stats').set(auth()).expect(200),
        request(app).get('/api/inventory/medicines').set(auth()).expect(200),
        request(app).get('/api/inventory/low-stock').set(auth()).expect(200),
        request(app).get('/api/inventory/expiring').set(auth()).expect(200),
      ])

      expect(stats.body.totalMedicines).toBe(medicines.body.length)
      expect(stats.body.lowStock).toBe(low.body.length)

      // Expiring Soon lists both the near-expiry and the already-expired, so
      // the two tiles together account for exactly that tab.
      expect(stats.body.expiringSoon + stats.body.expired).toBe(
        expiring.body.length,
      )
    })

    it('matches the seeded figures the design was drawn against', async () => {
      const res = await request(app)
        .get('/api/inventory/stats')
        .set(auth())
        .expect(200)

      // Stable regardless of what else the suite has created: the seeded
      // low-stock pair is Ferrous Sulfate and Oxytocin, the two near-expiry
      // batches are at +3 and +5 days, and nothing is past its date.
      expect(res.body.lowStock).toBe(2)
      expect(res.body.expiringSoon).toBe(2)
      expect(res.body.expired).toBe(0)
      expect(res.body.totalMedicines).toBeGreaterThanOrEqual(8)
    })

    it('counts days left from the clinic-local date', async () => {
      const res = await request(app)
        .get('/api/inventory/expiring')
        .set(auth())
        .expect(200)

      const soonest = res.body[0]
      expect(soonest).toEqual({
        batchId: expect.any(String),
        medicineId: expect.any(String),
        genericName: expect.any(String),
        batchNo: expect.any(String),
        expiresAt: expect.any(String),
        daysLeft: expect.any(Number),
      })

      // Seeded at +3 and +5 days. If this drifts by one, clinic_today() is
      // being bypassed somewhere and UTC has crept back in.
      expect(res.body.map((r: { daysLeft: number }) => r.daysLeft)).toEqual([
        3, 5,
      ])
    })

    it('keeps inventory away from patients entirely', async () => {
      // "The patient never sees your inventory, or your supplier costs."
      await request(app).get('/api/inventory/medicines').expect(401)
      await request(app)
        .get('/api/inventory/medicines')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(403)
    })
  })

  describe('stock movements', () => {
    let medicineId: string

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/inventory/medicines')
        .set(auth())
        .send({
          genericName: `Test Medicine ${Date.now()}`,
          brandName: 'Testamol',
          category: 'Analgesic',
          dosageForm: 'Tablet',
          dosage: '100mg',
          unit: 'pcs',
          reorderLevel: 50,
          unitCost: 1,
          sellingPrice: 2,
        })
        .expect(201)

      medicineId = res.body.id

      // A brand-new medicine has no batches, so it is genuinely out of stock.
      expect(res.body.qtyOnHand).toBe(0)
      expect(res.body.stockStatus).toBe('out')
    })

    it('tops up an existing batch rather than opening a second one', async () => {
      const first = await request(app)
        .post('/api/inventory/stock-in')
        .set(auth())
        .send({
          medicineId,
          batchNo: 'T-001',
          quantity: 100,
          expiresAt: '2027-12-31',
          note: 'First delivery',
        })
        .expect(201)

      const second = await request(app)
        .post('/api/inventory/stock-in')
        .set(auth())
        .send({
          medicineId,
          batchNo: 'T-001',
          quantity: 50,
          expiresAt: '2027-12-31',
          note: 'Second delivery of the same lot',
        })
        .expect(201)

      expect(second.body.id).toBe(first.body.id)
      expect(second.body.quantity).toBe(150)

      // One lot, one row in the Expiration Tracker — but two movements, because
      // the log records events and two deliveries happened.
      const batches = await request(app)
        .get(`/api/inventory/medicines/${medicineId}/batches`)
        .set(auth())
        .expect(200)

      expect(batches.body).toHaveLength(1)
    })

    it('records who dispensed what', async () => {
      const batches = await request(app)
        .get(`/api/inventory/medicines/${medicineId}/batches`)
        .set(auth())
        .expect(200)

      const out = await request(app)
        .post('/api/inventory/stock-out')
        .set(auth())
        .send({
          batchId: batches.body[0].id,
          quantity: 30,
          note: 'Dispensed to patient',
        })
        .expect(201)

      expect(out.body.quantity).toBe(120)

      const log = await request(app)
        .get('/api/inventory/movements')
        .set(auth())
        .expect(200)

      expect(log.body[0]).toMatchObject({
        type: 'stock_out',
        quantity: 30,
        note: 'Dispensed to patient',
        createdBy: 'Hannah Puerta',
      })
    })

    it('refuses an over-draw and leaves the batch untouched', async () => {
      const batches = await request(app)
        .get(`/api/inventory/medicines/${medicineId}/batches`)
        .set(auth())
        .expect(200)

      const batch = batches.body[0]
      const before = batch.quantity

      const res = await request(app)
        .post('/api/inventory/stock-out')
        .set(auth())
        .send({ batchId: batch.id, quantity: before + 1, note: 'Too much' })

      expect(res.status).toBe(409)
      expect(res.body.error).toMatch(/only \d+ remaining/)

      const after = await request(app)
        .get(`/api/inventory/medicines/${medicineId}/batches`)
        .set(auth())
        .expect(200)

      expect(after.body[0].quantity).toBe(before)

      // And nothing was written to the log either — a refused dispensal is not
      // an event that happened.
      const { count } = await getSupabaseClient()
        .from('stock_movements')
        .select('*', { count: 'exact', head: true })
        .eq('note', 'Too much')

      expect(count).toBe(0)
    })

    it('does not let concurrent dispensals drive a batch negative', async () => {
      const fresh = await request(app)
        .post('/api/inventory/stock-in')
        .set(auth())
        .send({
          medicineId,
          batchNo: `RACE-${Date.now()}`,
          quantity: 10,
          expiresAt: '2027-12-31',
          note: 'Race test',
        })
        .expect(201)

      // Ten simultaneous attempts to take 2 from a batch of 10. Exactly five
      // can succeed. record_stock_out locks the row before reading it, so the
      // rest see the updated quantity rather than all passing the same check.
      const attempts = await Promise.all(
        Array.from({ length: 10 }, () =>
          request(app)
            .post('/api/inventory/stock-out')
            .set(auth())
            .send({ batchId: fresh.body.id, quantity: 2, note: 'Race' }),
        ),
      )

      const ok = attempts.filter((r) => r.status === 201)
      const refused = attempts.filter((r) => r.status === 409)

      expect(ok).toHaveLength(5)
      expect(refused).toHaveLength(5)

      const after = await request(app)
        .get(`/api/inventory/medicines/${medicineId}/batches`)
        .set(auth())
        .expect(200)

      const raceBatch = after.body.find(
        (b: { id: string }) => b.id === fresh.body.id,
      )
      expect(raceBatch.quantity).toBe(0)
    })

    it('rejects a zero or negative quantity', async () => {
      const batches = await request(app)
        .get(`/api/inventory/medicines/${medicineId}/batches`)
        .set(auth())
        .expect(200)

      await request(app)
        .post('/api/inventory/stock-out')
        .set(auth())
        .send({ batchId: batches.body[0].id, quantity: 0, note: '' })
        .expect(400)

      await request(app)
        .post('/api/inventory/stock-in')
        .set(auth())
        .send({
          medicineId,
          batchNo: 'NEG',
          quantity: -5,
          expiresAt: '2027-12-31',
        })
        .expect(400)
    })
  })
})
