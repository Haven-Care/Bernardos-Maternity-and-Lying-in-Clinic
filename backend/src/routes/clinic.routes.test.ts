import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import {
  ADMIN_EMAIL,
  STAFF_PASSWORD,
  signIn,
  stackIsUp,
} from '../test/stack.js'

const app = createApp()
const up = await stackIsUp()

describe.skipIf(!up)('services, slots and clinic', () => {
  let staff: string
  const auth = () => ({ Authorization: `Bearer ${staff}` })

  beforeAll(async () => {
    staff = await signIn(ADMIN_EMAIL, STAFF_PASSWORD)
  })

  describe('services', () => {
    it('returns the contract shape', async () => {
      const res = await request(app).get('/api/services').expect(200)

      expect(res.body.length).toBeGreaterThan(0)
      // camelCase, and price a number rather than the string a numeric column
      // can arrive as.
      expect(res.body[0]).toEqual({
        id: expect.any(String),
        name: expect.any(String),
        category: expect.any(String),
        price: expect.any(Number),
        active: expect.any(Boolean),
      })
    })

    it('hides deactivated services from anonymous callers but not from staff', async () => {
      const created = await request(app)
        .post('/api/services')
        .set(auth())
        .send({ name: 'Temporarily Withdrawn', category: 'Test', price: 123 })
        .expect(201)

      await request(app)
        .patch(`/api/services/${created.body.id}`)
        .set(auth())
        .send({ active: false })
        .expect(200)

      const anon = await request(app).get('/api/services').expect(200)
      const asStaff = await request(app)
        .get('/api/services')
        .set(auth())
        .expect(200)

      const ids = (r: { body: { id: string }[] }) => r.body.map((s) => s.id)

      // The whole point of scoping by caller: the booking form must never be
      // offered something the clinic has withdrawn, while Services & Pricing
      // has to show it in order to switch it back on.
      expect(ids(anon)).not.toContain(created.body.id)
      expect(ids(asStaff)).toContain(created.body.id)
    })

    it('refuses writes without a token', async () => {
      await request(app)
        .post('/api/services')
        .send({ name: 'Sneaky', price: 1 })
        .expect(401)
    })

    it('rejects a negative price', async () => {
      await request(app)
        .post('/api/services')
        .set(auth())
        .send({ name: 'Backwards', price: -5 })
        .expect(400)
    })
  })

  describe('slots', () => {
    it('serves availability publicly and in the contract shape', async () => {
      // A Monday, which the seeded grid always has slots for.
      const res = await request(app)
        .get('/api/slots/availability?date=2026-09-21')
        .expect(200)

      expect(res.body.length).toBeGreaterThan(0)
      expect(res.body[0]).toEqual({
        id: expect.any(String),
        weekday: 'monday',
        time: expect.stringMatching(/^\d{2}:\d{2}$/),
        capacity: expect.any(Number),
        isOpen: expect.any(Boolean),
        booked: expect.any(Number),
        available: expect.any(Boolean),
      })
    })

    it('reports no slots on a Sunday rather than failing', async () => {
      // Sunday is closed, so it has no slots at all — not closed slots.
      const res = await request(app)
        .get('/api/slots/availability?date=2026-09-20')
        .expect(200)

      expect(res.body).toEqual([])
    })

    it('rejects a malformed date', async () => {
      await request(app).get('/api/slots/availability?date=nonsense').expect(400)
    })

    it('keeps the weekly grid staff-only', async () => {
      await request(app).get('/api/slots').expect(401)
      await request(app).get('/api/slots').set(auth()).expect(200)
    })

    /**
     * The booking form greys out days the clinic does not open, and needs this
     * to know which those are. It used to ask `GET /slots` — staff-only — so
     * every patient got a 403 and a date strip with every day disabled. It went
     * unnoticed because anyone testing the form had a staff session in the same
     * browser.
     *
     * Asserted unauthenticated on purpose: that is the caller that was broken.
     */
    it('serves the open weekdays to an anonymous caller', async () => {
      const res = await request(app).get('/api/slots/weekdays').expect(200)

      // The seeded grid runs Monday to Saturday; Sunday has no slots at all.
      expect(res.body).toEqual([
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
      ])
    })

    it('leaks nothing beyond the weekday names', async () => {
      const res = await request(app).get('/api/slots/weekdays').expect(200)

      // Strings, not slot records — no capacities, no ids, and no sign of a
      // blocked slot. Widening this to objects would put the Administration
      // view back on a public URL.
      for (const day of res.body) {
        expect(typeof day).toBe('string')
      }
    })

    it('refuses a duplicate time on the same weekday', async () => {
      const res = await request(app)
        .post('/api/slots')
        .set(auth())
        .send({ weekday: 'monday', time: '08:00', capacity: 2 })

      expect(res.status).toBe(409)
      expect(res.body.error).toMatch(/already exists/)
    })

    it('blocks a slot without touching the bookings already in it', async () => {
      const grid = await request(app)
        .get('/api/slots?weekday=tuesday')
        .set(auth())
        .expect(200)

      const slot = grid.body[0]

      const blocked = await request(app)
        .patch(`/api/slots/${slot.id}`)
        .set(auth())
        .send({ isOpen: false })
        .expect(200)

      expect(blocked.body.isOpen).toBe(false)
      expect(blocked.body.capacity).toBe(slot.capacity)

      await request(app)
        .patch(`/api/slots/${slot.id}`)
        .set(auth())
        .send({ isOpen: true })
        .expect(200)
    })
  })

  describe('clinic', () => {
    it('serves the clinic details publicly', async () => {
      const res = await request(app).get('/api/clinic').expect(200)

      expect(res.body).toMatchObject({
        name: expect.any(String),
        licenseNo: expect.any(String),
        address: expect.any(String),
      })
    })

    it('serves opening hours publicly', async () => {
      const res = await request(app).get('/api/clinic/hours').expect(200)

      const sunday = res.body.find((r: { key: string }) => r.key === 'sunday')
      expect(sunday).toMatchObject({
        closed: true,
        opensAt: null,
        closesAt: null,
      })
    })

    it('keeps settings and every write behind authentication', async () => {
      await request(app).get('/api/clinic/settings').expect(401)
      await request(app).patch('/api/clinic').send({ name: 'x' }).expect(401)
      await request(app).put('/api/clinic/hours').send([]).expect(401)
    })

    it('returns settings in the contract shape', async () => {
      const res = await request(app)
        .get('/api/clinic/settings')
        .set(auth())
        .expect(200)

      expect(res.body).toEqual({
        nearExpiryDays: expect.any(Number),
        reminderLeadHours: expect.any(Number),
        // Null until Administration grows a control for it.
        dailyBookingCapacity: null,
      })
    })

    it('refuses hours that contradict themselves', async () => {
      const closedWithTimes = await request(app)
        .put('/api/clinic/hours')
        .set(auth())
        .send([
          {
            key: 'sunday',
            label: 'Sunday',
            opensAt: '08:00',
            closesAt: '12:00',
            closed: true,
          },
        ])

      expect(closedWithTimes.status).toBe(400)

      const backwards = await request(app)
        .put('/api/clinic/hours')
        .set(auth())
        .send([
          {
            key: 'monday',
            label: 'Monday',
            opensAt: '17:00',
            closesAt: '08:00',
            closed: false,
          },
        ])

      expect(backwards.status).toBe(400)
      expect(backwards.body.error).toMatch(/closes before it opens/)
    })
  })
})
