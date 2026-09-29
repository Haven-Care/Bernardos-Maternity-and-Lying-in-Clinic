import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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

/**
 * The Dashboard is the one screen whose numbers come from everywhere else, so
 * almost everything here is asserted as *agreement* rather than as a fixed
 * figure: the tile must equal what the tab it links to lists.
 *
 * A test that hardcoded "3 low stock medicines" would pass while both the tile
 * and the tab were wrong in the same way, and would fail every time the seed
 * changed. Agreement is the property that actually matters — a tile that
 * disagrees with its tab is the bug this screen can have.
 */
describe.skipIf(!up)('dashboard', () => {
  let staff: string
  let patient: { token: string; userId: string }

  /**
   * Unique per run, like the addresses from uniqueEmail().
   *
   * The notification this patient's booking writes is matched by name, and
   * notifications are clinic-wide with nothing to cascade from — so a fixed
   * name would find the row left by the previous run and the test would only
   * pass against a freshly reset database.
   */
  const patientName = `Dash ${Date.now()}`

  const asStaff = () => ({ Authorization: `Bearer ${staff}` })

  beforeAll(async () => {
    staff = await signIn(ADMIN_EMAIL, STAFF_PASSWORD)
    patient = await signUpPatient(uniqueEmail('dash'), 'Sup3rSecret!', patientName)
  })

  afterAll(async () => {
    if (!patient) return

    const db = getSupabaseClient()
    await db.from('appointments').delete().eq('account_id', patient.userId)
    await db.from('patients').delete().eq('account_id', patient.userId)
    await db.from('notifications').delete().like('message', `${patientName}%`)
    await db.auth.admin.deleteUser(patient.userId)
  })

  describe('stats', () => {
    it('returns the four tiles as whole numbers', async () => {
      const res = await request(app)
        .get('/api/dashboard/stats')
        .set(asStaff())
        .expect(200)

      expect(res.body).toEqual({
        todaysSchedule: expect.any(Number),
        bookedToday: expect.any(Number),
        completedAppointments: expect.any(Number),
        inventoryAlerts: expect.any(Number),
      })

      for (const value of Object.values(res.body)) {
        expect(Number.isInteger(value)).toBe(true)
      }
    })

    it('counts Booked Today as the Bookings tab does', async () => {
      const { data: clinicToday } = await getSupabaseClient().rpc('clinic_today')

      const [stats, bookings] = await Promise.all([
        request(app).get('/api/dashboard/stats').set(asStaff()).expect(200),
        request(app).get('/api/bookings').set(asStaff()).expect(200),
      ])

      // Submissions, not visits — the tile answers "what arrived today",
      // whatever day those appointments are for. `submittedAt` is an ISO
      // instant in UTC and the clinic is UTC+8, so it has to be read in Manila
      // before its date is taken, exactly as dashboard_stats() does.
      const bookedToday = bookings.body.filter((b: { submittedAt: string }) => {
        const manila = new Date(b.submittedAt).toLocaleDateString('en-CA', {
          timeZone: 'Asia/Manila',
        })
        return manila === clinicToday
      }).length

      const completed = bookings.body.filter(
        (b: { status: string }) => b.status === 'completed',
      ).length

      expect(stats.body.bookedToday).toBe(bookedToday)
      expect(stats.body.completedAppointments).toBe(completed)
    })

    /**
     * The tile that replaced "Booking Requests".
     *
     * That one counted pending bookings and became a permanent zero the moment
     * bookings started being accepted on submission. A tile stuck at zero looks
     * like a broken query rather than a quiet day, so this asserts the number
     * actually moves.
     */
    it('moves Booked Today when a patient books', async () => {
      const before = await request(app)
        .get('/api/dashboard/stats')
        .set(asStaff())
        .expect(200)

      const services = await request(app).get('/api/services').expect(200)
      const serviceId = services.body.find(
        (s: { name: string }) => s.name === 'Consultation',
      ).id

      const { data: today } = await getSupabaseClient().rpc('clinic_today')
      const date = new Date(`${today}T00:00:00Z`)
      do {
        date.setUTCDate(date.getUTCDate() + 1)
      } while (date.getUTCDay() !== 1)
      date.setUTCDate(date.getUTCDate() + 10 * 7)
      const scheduledDate = date.toISOString().slice(0, 10)

      const slots = await request(app)
        .get(`/api/slots/availability?date=${scheduledDate}`)
        .expect(200)
      const slot = slots.body.find((s: { available: boolean }) => s.available)

      await request(app)
        .post('/api/bookings')
        .set({ Authorization: `Bearer ${patient.token}` })
        .send({
          serviceId,
          scheduledDate,
          slotTime: slot.time,
          reasonForVisit: 'Booked today tile',
        })
        .expect(201)

      const after = await request(app)
        .get('/api/dashboard/stats')
        .set(asStaff())
        .expect(200)

      // Greater-than rather than exactly +1: the bookings suite runs in
      // parallel and books against the same clinic, so the delta is ours plus
      // whatever theirs did. That it moves at all is the property under test.
      expect(after.body.bookedToday).toBeGreaterThan(before.body.bookedToday)
    })

    it("counts Today's Schedule against the clinic's today, not the server's", async () => {
      const { data: clinicToday } = await getSupabaseClient().rpc('clinic_today')

      const [stats, bookings] = await Promise.all([
        request(app).get('/api/dashboard/stats').set(asStaff()).expect(200),
        request(app).get('/api/bookings').set(asStaff()).expect(200),
      ])

      // Cancelled bookings are excluded: the tile answers "who is coming in
      // today", and someone who cancelled is not.
      const today = bookings.body.filter(
        (b: { scheduledDate: string; status: string }) =>
          b.scheduledDate === clinicToday && b.status !== 'cancelled',
      ).length

      expect(stats.body.todaysSchedule).toBe(today)
    })

    it('counts Inventory Alerts as low stock plus near expiry', async () => {
      const [stats, lowStock, expiring] = await Promise.all([
        request(app).get('/api/dashboard/stats').set(asStaff()).expect(200),
        request(app).get('/api/inventory/low-stock').set(asStaff()).expect(200),
        request(app).get('/api/inventory/expiring').set(asStaff()).expect(200),
      ])

      expect(stats.body.inventoryAlerts).toBe(
        lowStock.body.length + expiring.body.length,
      )
    })
  })

  describe('appointments overview', () => {
    it('returns slices whose counts and percentages agree with each other', async () => {
      const [overview, bookings] = await Promise.all([
        request(app)
          .get('/api/dashboard/appointments-overview')
          .set(asStaff())
          .expect(200),
        request(app).get('/api/bookings').set(asStaff()).expect(200),
      ])

      const total = bookings.body.length
      const counted = overview.body.reduce(
        (sum: number, s: { count: number }) => sum + s.count,
        0,
      )

      expect(counted).toBe(total)

      for (const slice of overview.body) {
        expect(slice).toEqual({
          status: expect.any(String),
          count: expect.any(Number),
          percentage: expect.any(Number),
        })
        // The server rounds to one decimal, so the true value can sit up to
        // 0.05 away — inclusive. toBeCloseTo(x, 1) demands strictly under 0.05
        // and fails on every .x5 boundary (5/16 = 31.25 -> 31.3).
        //
        // Measured against `counted`, the overview's own total, not the
        // bookings list fetched alongside it: the bookings suite runs in
        // parallel, and a booking landing between the two requests would
        // otherwise skew every percentage.
        const exact = (slice.count / counted) * 100
        expect(Math.abs(slice.percentage - exact)).toBeLessThanOrEqual(0.05 + 1e-9)
      }
    })

    it('omits statuses with no appointments rather than drawing a 0% wedge', async () => {
      const res = await request(app)
        .get('/api/dashboard/appointments-overview')
        .set(asStaff())
        .expect(200)

      for (const slice of res.body) {
        expect(slice.count).toBeGreaterThan(0)
      }
    })

    it('orders slices by the contract status order, not by size', async () => {
      const res = await request(app)
        .get('/api/dashboard/appointments-overview')
        .set(asStaff())
        .expect(200)

      const order = [
        'pending',
        'confirmed',
        'rescheduled',
        'cancelled',
        'completed',
      ]
      const positions = res.body.map((s: { status: string }) =>
        order.indexOf(s.status),
      )

      expect(positions).not.toContain(-1)
      expect(positions).toEqual([...positions].sort((a, b) => a - b))
    })
  })

  describe('urgent alerts', () => {
    it('returns the contract shape', async () => {
      const res = await request(app)
        .get('/api/dashboard/alerts')
        .set(asStaff())
        .expect(200)

      expect(res.body.length).toBeGreaterThan(0)

      for (const alert of res.body) {
        expect(alert).toEqual({
          id: expect.any(String),
          kind: expect.stringMatching(
            /^(low_stock|reorder_level|expiring_soon|booking_review)$/,
          ),
          severity: expect.stringMatching(/^(critical|warning|info)$/),
          subject: expect.any(String),
          message: expect.any(String),
          detail: expect.any(String),
          href: expect.stringMatching(/^\//),
        })
      }
    })

    it('sorts critical before warning before info', async () => {
      const res = await request(app)
        .get('/api/dashboard/alerts')
        .set(asStaff())
        .expect(200)

      const rank = { critical: 0, warning: 1, info: 2 }
      const ranks = res.body.map(
        (a: { severity: keyof typeof rank }) => rank[a.severity],
      )

      expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    })

    it('raises one stock alert per medicine on the Low Stock tab', async () => {
      const [alerts, lowStock] = await Promise.all([
        request(app).get('/api/dashboard/alerts').set(asStaff()).expect(200),
        request(app).get('/api/inventory/low-stock').set(asStaff()).expect(200),
      ])

      const alerted = alerts.body
        .filter((a: { kind: string }) =>
          ['low_stock', 'reorder_level'].includes(a.kind),
        )
        .map((a: { subject: string }) => a.subject)
        .sort()

      const listed = lowStock.body
        .map((m: { genericName: string }) => m.genericName)
        .sort()

      expect(alerted).toEqual(listed)
    })

    /**
     * `booking_review` now means the reschedule queue.
     *
     * It used to count bookings awaiting confirmation, which under
     * auto-acceptance is permanently zero — so the alert could never fire
     * again. The reschedule queue inherited the problem it was solving: it is
     * the only thing left that waits on a human, and it had no Dashboard
     * presence at all.
     *
     * Driven end to end rather than asserted against the seed, because the seed
     * has no open requests and a queue-derived alert is only worth anything if
     * it appears *and* disappears.
     */
    it('raises a reschedule alert that clears when the queue is worked', async () => {
      const db = getSupabaseClient()

      /**
       * How many open requests the alert is currently reporting.
       *
       * Read as a baseline rather than asserted to be zero: the bookings suite
       * runs in parallel against the same clinic and opens reschedule requests
       * of its own, so the only stable facts are that our request adds one and
       * declining it takes one away.
       */
      const openCount = async (): Promise<number> => {
        const res = await request(app)
          .get('/api/dashboard/alerts')
          .set(asStaff())
          .expect(200)

        const alert = res.body.find(
          (a: { kind: string }) => a.kind === 'booking_review',
        )
        if (!alert) return 0

        return Number(/^(\d+)/.exec(alert.subject)?.[1] ?? 0)
      }

      const baseline = await openCount()

      // A booking of our own to propose moving, kept well clear of the seeded
      // range so it cannot collide with another suite's slots.
      const services = await request(app).get('/api/services').expect(200)
      const serviceId = services.body.find(
        (s: { name: string }) => s.name === 'Consultation',
      ).id

      const { data: today } = await getSupabaseClient().rpc('clinic_today')
      const pick = (weeks: number) => {
        const d = new Date(`${today}T00:00:00Z`)
        do {
          d.setUTCDate(d.getUTCDate() + 1)
        } while (d.getUTCDay() !== 1)
        d.setUTCDate(d.getUTCDate() + weeks * 7)
        return d.toISOString().slice(0, 10)
      }

      const scheduledDate = pick(11)
      const proposedDate = pick(12)

      const avail = await request(app)
        .get(`/api/slots/availability?date=${scheduledDate}`)
        .expect(200)
      const slot = avail.body.find((s: { available: boolean }) => s.available)

      const booking = await request(app)
        .post('/api/bookings')
        .set({ Authorization: `Bearer ${patient.token}` })
        .send({
          serviceId,
          scheduledDate,
          slotTime: slot.time,
          reasonForVisit: 'Reschedule alert',
        })
        .expect(201)

      const proposedAvail = await request(app)
        .get(`/api/slots/availability?date=${proposedDate}`)
        .expect(200)
      const proposedSlot = proposedAvail.body.find(
        (s: { available: boolean }) => s.available,
      )

      await request(app)
        .post(`/api/me/bookings/${booking.body.id}/reschedule-request`)
        .set({ Authorization: `Bearer ${patient.token}` })
        .send({ proposedDate, proposedTime: proposedSlot.time })
        .expect(201)

      expect(await openCount()).toBe(baseline + 1)

      const raised = await request(app)
        .get('/api/dashboard/alerts')
        .set(asStaff())
        .expect(200)

      const alert = raised.body.filter(
        (a: { kind: string }) => a.kind === 'booking_review',
      )

      // One alert, not one per request — the feed is a fixed-height panel.
      expect(alert).toHaveLength(1)
      expect(alert[0].subject).toMatch(/^\d+ reschedule requests?$/)
      expect(alert[0].message).toBe('awaiting approval')
      expect(alert[0].href).toContain('tab=reschedules')
      expect(alert[0].severity).toBe('info')
      // Every open request was made during this run, so the oldest is from
      // today. Asserted exactly because the label once sliced the UTC date and
      // read "yesterday" for anything asked between midnight and 8 AM Manila.
      expect(alert[0].detail).toBe('Oldest asked today')

      // Working the queue clears it.
      const queue = await request(app)
        .get('/api/reschedule-requests')
        .set(asStaff())
        .expect(200)

      const mine = queue.body.find(
        (r: { bookingId: string }) => r.bookingId === booking.body.id,
      )

      await request(app)
        .post(`/api/reschedule-requests/${mine.id}/decline`)
        .set(asStaff())
        .expect(200)

      expect(await openCount()).toBe(baseline)

      await db.from('appointments').delete().eq('id', booking.body.id)
    })

    it('is derived, not stored — dispensing stock moves the count', async () => {
      const db = getSupabaseClient()

      const before = await request(app)
        .get('/api/dashboard/stats')
        .set(asStaff())
        .expect(200)

      // Draw a medicine that is currently healthy down below its reorder level.
      // Every column of a view is nullable in the generated types — Postgres
      // cannot promise otherwise — so the non-null assertions are the same ones
      // the inventory mapper makes at its own boundary.
      const { data: medicine } = await db
        .from('medicine_stock')
        .select('id, reorder_level, qty_on_hand')
        .eq('stock_status', 'good')
        .gt('reorder_level', 0)
        .limit(1)
        .single()

      const medicineId = medicine!.id!

      const { data: batch } = await db
        .from('medicine_batches')
        .select('*')
        .eq('medicine_id', medicineId)
        .gt('quantity', 0)
        .order('quantity', { ascending: false })
        .limit(1)
        .single()

      const toRemove = Math.min(
        batch!.quantity,
        medicine!.qty_on_hand! - medicine!.reorder_level! + 1,
      )

      await request(app)
        .post('/api/inventory/stock-out')
        .set(asStaff())
        .send({ batchId: batch!.id, quantity: toRemove, note: 'dashboard test' })
        .expect(201)

      try {
        const after = await request(app)
          .get('/api/dashboard/stats')
          .set(asStaff())
          .expect(200)

        expect(after.body.inventoryAlerts).toBeGreaterThan(
          before.body.inventoryAlerts,
        )
      } finally {
        // Put it back, so the suite can run twice and so the alert-agreement
        // tests above do not depend on which order vitest ran them in. Same
        // batch number and expiry, so record_stock_in tops the lot up rather
        // than opening a second one.
        await request(app)
          .post('/api/inventory/stock-in')
          .set(asStaff())
          .send({
            medicineId,
            batchNo: batch!.batch_no,
            quantity: toRemove,
            expiresAt: batch!.expires_at,
            note: 'dashboard test rollback',
          })
          .expect(201)
      }
    })
  })

  describe('notifications', () => {
    it('returns the header dropdown in newest-first order', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set(asStaff())
        .expect(200)

      expect(res.body.length).toBeGreaterThan(0)

      for (const n of res.body) {
        expect(n).toEqual({
          id: expect.any(String),
          message: expect.any(String),
          occurredAt: expect.any(String),
          read: expect.any(Boolean),
        })
      }

      const times = res.body.map((n: { occurredAt: string }) =>
        Date.parse(n.occurredAt),
      )
      expect(times).toEqual([...times].sort((a, b) => b - a))
    })

    /**
     * The trigger, not the endpoint.
     *
     * Notifications are written by a trigger on the appointments insert rather
     * than by the booking controller, so this asserts the property that buys:
     * a booking cannot be recorded without the desk being told about it, by any
     * code path, including ones written later.
     */
    it('writes one when a patient submits a booking', async () => {
      const db = getSupabaseClient()

      const { data: today } = await db.rpc('clinic_today')
      const date = new Date(`${today}T00:00:00Z`)
      do {
        date.setUTCDate(date.getUTCDate() + 1)
      } while (date.getUTCDay() !== 1)
      date.setUTCDate(date.getUTCDate() + 8 * 7)
      const scheduledDate = date.toISOString().slice(0, 10)

      const services = await request(app).get('/api/services').expect(200)
      const serviceId = services.body.find(
        (s: { name: string }) => s.name === 'Consultation',
      ).id

      const slots = await request(app)
        .get(`/api/slots/availability?date=${scheduledDate}`)
        .expect(200)
      const slot = slots.body.find((s: { available: boolean }) => s.available)

      // Found by name rather than counted. Vitest runs the suites in parallel
      // and the bookings suite is submitting bookings of its own, so the size
      // of a clinic-wide list is not this test's to predict.
      const mine = (rows: { message: string }[]) =>
        rows.filter((n) => n.message.includes(patientName))

      const before = await request(app)
        .get('/api/notifications')
        .set(asStaff())
        .expect(200)

      // A baseline, not zero: earlier tests in this file book and reschedule as
      // the same patient, and each of those wrote a notification of its own.
      const beforeCount = mine(before.body).length

      await request(app)
        .post('/api/bookings')
        .set({ Authorization: `Bearer ${patient.token}` })
        .send({
          serviceId,
          scheduledDate,
          slotTime: slot.time,
          reasonForVisit: 'Notification trigger test',
        })
        .expect(201)

      const after = await request(app)
        .get('/api/notifications')
        .set(asStaff())
        .expect(200)

      const written = mine(after.body)

      expect(written).toHaveLength(beforeCount + 1)
      // Newest first, so ours is at the head.
      expect(written[0]).toMatchObject({
        message: expect.stringContaining('Consultation'),
        read: false,
      })
      // "… booked Consultation on Nov 17, 09:00" — "booked", not "requested",
      // since bookings are accepted on submission. The month name comes from
      // short_date(), not to_char(), so it cannot follow the server's locale.
      expect(written[0].message).toMatch(
        new RegExp(`^${patientName} booked .+ on [A-Z][a-z]{2} \\d{1,2}, \\d{2}:\\d{2}$`),
      )
    })
  })

  describe('authorization', () => {
    it('refuses a patient on every dashboard route', async () => {
      const asPatient = { Authorization: `Bearer ${patient.token}` }

      for (const path of [
        '/api/dashboard/stats',
        '/api/dashboard/appointments-overview',
        '/api/dashboard/alerts',
        '/api/notifications',
      ]) {
        await request(app).get(path).set(asPatient).expect(403)
      }
    })

    it('refuses an unauthenticated caller on every dashboard route', async () => {
      for (const path of [
        '/api/dashboard/stats',
        '/api/dashboard/appointments-overview',
        '/api/dashboard/alerts',
        '/api/notifications',
      ]) {
        await request(app).get(path).expect(401)
      }
    })
  })
})
