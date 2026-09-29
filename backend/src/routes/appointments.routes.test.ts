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
 * A Monday far enough out to be empty, as YYYY-MM-DD.
 *
 * The seed places bookings from 21 days back to 8 days ahead, and fills some
 * slots to capacity — so "next Monday" is not a blank canvas and tests that
 * assumed it was got 409s from slots the seed had already filled. Starting four
 * weeks out clears that range, and each `offsetWeeks` gives a suite its own
 * untouched week so they cannot fill each other's slots.
 */
async function clinicDate(offsetWeeks = 0): Promise<string> {
  const { data } = await getSupabaseClient().rpc('clinic_today')
  const d = new Date(`${data}T00:00:00Z`)

  do {
    d.setUTCDate(d.getUTCDate() + 1)
  } while (d.getUTCDay() !== 1)

  d.setUTCDate(d.getUTCDate() + (4 + offsetWeeks) * 7)
  return d.toISOString().slice(0, 10)
}

describe.skipIf(!up)('bookings', () => {
  let staff: string
  let alice: { token: string; userId: string }
  let bob: { token: string; userId: string }
  let serviceId: string

  const asStaff = () => ({ Authorization: `Bearer ${staff}` })
  const asAlice = () => ({ Authorization: `Bearer ${alice.token}` })
  const asBob = () => ({ Authorization: `Bearer ${bob.token}` })

  beforeAll(async () => {
    staff = await signIn(ADMIN_EMAIL, STAFF_PASSWORD)
    alice = await signUpPatient(uniqueEmail('alice'), 'Sup3rSecret!', 'Alice A')
    bob = await signUpPatient(uniqueEmail('bob'), 'Sup3rSecret!', 'Bob B')

    const services = await request(app).get('/api/services').expect(200)
    serviceId = services.body.find(
      (s: { name: string }) => s.name === 'Consultation',
    ).id
  })

  /**
   * Give the slots back.
   *
   * Unlike the other suites, these tests consume a finite resource: a seat in a
   * slot. Leaving them behind means the second run of this file finds its
   * chosen times already full and fails with 409s that look like real capacity
   * bugs — which is exactly what happened before this existed.
   *
   * Deleting the appointments cascades their reschedule requests. The accounts
   * go too, so nothing accumulates in auth.users either.
   *
   * Notifications do not cascade — they are clinic-wide and have no foreign key
   * to hang off — so they are cleared by name. Without this each run leaves a
   * dozen "Alice A requested Consultation" rows behind and the header dropdown
   * on the demo database fills with test data.
   */
  afterAll(async () => {
    const db = getSupabaseClient()

    for (const acct of [alice, bob]) {
      if (!acct) continue

      await db.from('appointments').delete().eq('account_id', acct.userId)
      await db.from('patients').delete().eq('account_id', acct.userId)
      await db.auth.admin.deleteUser(acct.userId)
    }

    for (const name of ['Alice A', 'Bob B']) {
      await db.from('notifications').delete().like('message', `${name}%`)
    }
  })

  describe('creating', () => {
    it('materialises the clinical record on the first booking only', async () => {
      const db = getSupabaseClient()

      const before = await db
        .from('patients')
        .select('id')
        .eq('account_id', alice.userId)
        .maybeSingle()

      // Sign-up alone creates no patient record — a record carries gravida and
      // attending physician, which nobody supplies on a phone.
      expect(before.data).toBeNull()

      const date = await clinicDate()

      const first = await request(app)
        .post('/api/bookings')
        .set(asAlice())
        .send({
          serviceId,
          scheduledDate: date,
          slotTime: '08:00',
          reasonForVisit: 'First visit',
        })
        .expect(201)

      // `confirmed`, not `pending` — this is the assertion that says bookings
      // are accepted on submission. Every rule the clinic has was checked
      // inside book_appointment, under the lock, before the row existed.
      expect(first.body).toMatchObject({
        status: 'confirmed',
        serviceName: 'Consultation',
        patientName: 'Alice A',
      })
      expect(first.body.referenceNo).toMatch(/^BR-\d{4}$/)
      expect(first.body.patientId).toEqual(expect.any(String))

      const second = await request(app)
        .post('/api/bookings')
        .set(asAlice())
        .send({
          serviceId,
          scheduledDate: date,
          slotTime: '09:00',
          reasonForVisit: 'Second visit',
        })
        .expect(201)

      // The second booking reuses the record the first created.
      expect(second.body.patientId).toBe(first.body.patientId)

      const { count } = await db
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', alice.userId)

      expect(count).toBe(1)
    })

    /**
     * The notify trigger, with nothing pending.
     *
     * It used to fire `when (… and new.status = 'pending')`. Bookings arrive
     * confirmed now, so that clause would never match again — and a trigger
     * that silently stops firing is the worst possible failure for the one
     * mechanism that tells the clinic a patient is coming. Nothing else would
     * have caught it: the endpoint still returns 201 either way.
     */
    it('tells the desk about a booking even though nothing is pending', async () => {
      const db = getSupabaseClient()
      const date = await clinicDate(9)

      const before = await db
        .from('notifications')
        .select('id', { count: 'exact', head: true })

      const booking = await request(app)
        .post('/api/bookings')
        .set(asBob())
        .send({
          serviceId,
          scheduledDate: date,
          slotTime: '08:00',
          reasonForVisit: 'Notification trigger',
        })
        .expect(201)

      expect(booking.body.status).toBe('confirmed')

      const after = await db
        .from('notifications')
        .select('message')
        .order('occurred_at', { ascending: false })
        .limit(10)

      expect(after.data?.length).toBeGreaterThan(0)

      const mine = (after.data ?? []).filter((n) =>
        n.message.includes('Bob B'),
      )
      expect(mine.length).toBeGreaterThan(0)
      // "booked", not "requested" — the wording follows the behaviour.
      expect(mine[0].message).toMatch(/^Bob B booked /)

      const afterCount = await db
        .from('notifications')
        .select('id', { count: 'exact', head: true })

      expect(afterCount.count ?? 0).toBeGreaterThan(before.count ?? 0)
    })

    it('refuses a booking without an account', async () => {
      const date = await clinicDate()

      await request(app)
        .post('/api/bookings')
        .send({ serviceId, scheduledDate: date, slotTime: '10:00', reasonForVisit: '' })
        .expect(401)
    })

    it('refuses a date that has passed, a blocked slot, and a time that does not exist', async () => {
      const past = await request(app)
        .post('/api/bookings')
        .set(asBob())
        .send({
          serviceId,
          scheduledDate: '2020-01-06',
          slotTime: '08:00',
          reasonForVisit: '',
        })
      expect(past.status).toBe(400)
      expect(past.body.error).toMatch(/already passed/)

      // Wednesday 13:00 is blocked in the seed.
      const monday = await clinicDate()
      const wednesday = new Date(`${monday}T00:00:00Z`)
      wednesday.setUTCDate(wednesday.getUTCDate() + 2)

      const blocked = await request(app)
        .post('/api/bookings')
        .set(asBob())
        .send({
          serviceId,
          scheduledDate: wednesday.toISOString().slice(0, 10),
          slotTime: '13:00',
          reasonForVisit: '',
        })
      expect(blocked.status).toBe(409)
      // A blocked slot is indistinguishable from one that does not exist.
      expect(blocked.body.error).toMatch(/no longer available/)

      const noSuchTime = await request(app)
        .post('/api/bookings')
        .set(asBob())
        .send({
          serviceId,
          scheduledDate: monday,
          slotTime: '23:00',
          reasonForVisit: '',
        })
      expect(noSuchTime.status).toBe(409)
    })

    it('cannot sell the same seat twice under concurrency', async () => {
      // The pitch's strongest claim: double-booking is structurally impossible,
      // not merely unlikely. 09:00 on a weekday has capacity 1.
      const date = await clinicDate(2)

      const attempts = await Promise.all(
        Array.from({ length: 8 }, () =>
          request(app)
            .post('/api/bookings')
            .set(asBob())
            .send({
              serviceId,
              scheduledDate: date,
              slotTime: '09:00',
              reasonForVisit: 'Race',
            }),
        ),
      )

      const created = attempts.filter((r) => r.status === 201)
      const refused = attempts.filter((r) => r.status === 409)

      expect(created).toHaveLength(1)
      expect(refused).toHaveLength(7)
      expect(refused[0].body.error).toMatch(/just filled|no longer available/)

      const availability = await request(app)
        .get(`/api/slots/availability?date=${date}`)
        .expect(200)

      const slot = availability.body.find(
        (s: { time: string }) => s.time === '09:00',
      )
      expect(slot.booked).toBe(1)
      expect(slot.available).toBe(false)
    })
  })

  describe('a patient sees only their own', () => {
    it('lists only the caller’s bookings', async () => {
      const mine = await request(app)
        .get('/api/me/bookings')
        .set(asAlice())
        .expect(200)

      expect(mine.body.length).toBeGreaterThan(0)

      const { data: aliceRecord } = await getSupabaseClient()
        .from('patients')
        .select('id')
        .eq('account_id', alice.userId)
        .single()

      for (const booking of mine.body) {
        expect(booking.patientId).toBe(aliceRecord!.id)
      }

      const bobs = await request(app)
        .get('/api/me/bookings')
        .set(asBob())
        .expect(200)

      const aliceIds = new Set(mine.body.map((b: { id: string }) => b.id))
      for (const booking of bobs.body) {
        expect(aliceIds.has(booking.id)).toBe(false)
      }
    })

    it('cannot cancel somebody else’s booking', async () => {
      // The single most important authorization test here.
      const mine = await request(app)
        .get('/api/me/bookings')
        .set(asAlice())
        .expect(200)

      const target = mine.body[0]

      const res = await request(app)
        .delete(`/api/me/bookings/${target.id}`)
        .set(asBob())

      // 404, not 403 — "not yours" would confirm the id belongs to someone.
      expect(res.status).toBe(404)

      const still = await request(app)
        .get('/api/me/bookings')
        .set(asAlice())
        .expect(200)

      expect(
        still.body.find((b: { id: string }) => b.id === target.id).status,
      ).not.toBe('cancelled')
    })

    it('cannot request a reschedule on somebody else’s booking', async () => {
      const mine = await request(app)
        .get('/api/me/bookings')
        .set(asAlice())
        .expect(200)

      const date = await clinicDate(3)

      await request(app)
        .post(`/api/me/bookings/${mine.body[0].id}/reschedule-request`)
        .set(asBob())
        .send({ proposedDate: date, proposedTime: '10:00' })
        .expect(404)
    })

    it('keeps the staff booking queue away from patients', async () => {
      await request(app).get('/api/bookings').set(asAlice()).expect(403)
      await request(app).get('/api/bookings').expect(401)
    })
  })

  describe('cancel applies immediately', () => {
    it('frees the seat back up', async () => {
      const date = await clinicDate(4)

      const booking = await request(app)
        .post('/api/bookings')
        .set(asAlice())
        .send({
          serviceId,
          scheduledDate: date,
          slotTime: '09:00',
          reasonForVisit: 'Will cancel',
        })
        .expect(201)

      const full = await request(app)
        .get(`/api/slots/availability?date=${date}`)
        .expect(200)
      expect(
        full.body.find((s: { time: string }) => s.time === '09:00').available,
      ).toBe(false)

      const cancelled = await request(app)
        .delete(`/api/me/bookings/${booking.body.id}`)
        .set(asAlice())
        .expect(200)

      expect(cancelled.body.status).toBe('cancelled')

      const free = await request(app)
        .get(`/api/slots/availability?date=${date}`)
        .expect(200)
      expect(
        free.body.find((s: { time: string }) => s.time === '09:00').available,
      ).toBe(true)
    })

    it('closes the open reschedule request on the cancelled booking', async () => {
      const booking = await request(app)
        .post('/api/bookings')
        .set(asAlice())
        .send({
          serviceId,
          scheduledDate: await clinicDate(10),
          slotTime: '10:00',
          reasonForVisit: 'Cancel with a request open',
        })
        .expect(201)

      const filed = await request(app)
        .post(`/api/me/bookings/${booking.body.id}/reschedule-request`)
        .set(asAlice())
        .send({ proposedDate: await clinicDate(11), proposedTime: '10:00' })
        .expect(201)

      await request(app)
        .delete(`/api/me/bookings/${booking.body.id}`)
        .set(asAlice())
        .expect(200)

      // Left pending, it would sit in the staff queue and the Urgent Alerts
      // count for an appointment that no longer exists.
      const queue = await request(app)
        .get('/api/reschedule-requests')
        .set(asStaff())
        .expect(200)

      expect(
        queue.body.find((r: { id: string }) => r.id === filed.body.id),
      ).toBeUndefined()

      const declined = await request(app)
        .get('/api/reschedule-requests?status=declined')
        .set(asStaff())
        .expect(200)

      expect(
        declined.body.find((r: { id: string }) => r.id === filed.body.id),
      ).toBeDefined()
    })
  })

  describe('dates', () => {
    it('400s a date that does not exist instead of failing in Postgres', async () => {
      const res = await request(app)
        .post('/api/bookings')
        .set(asBob())
        .send({
          serviceId,
          scheduledDate: '2026-02-30',
          slotTime: '08:00',
          reasonForVisit: '',
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/does not exist/)

      await request(app).get('/api/slots/availability?date=2026-02-30').expect(400)
    })

    it('refuses to move a booking into the past, from either side', async () => {
      const booking = await request(app)
        .post('/api/bookings')
        .set(asBob())
        .send({
          serviceId,
          scheduledDate: await clinicDate(12),
          slotTime: '10:00',
          reasonForVisit: 'Past-date reschedule',
        })
        .expect(201)

      const byStaff = await request(app)
        .patch(`/api/bookings/${booking.body.id}/reschedule`)
        .set(asStaff())
        .send({ scheduledDate: '2020-01-06', slotTime: '08:00' })

      expect(byStaff.status).toBe(400)
      expect(byStaff.body.error).toMatch(/already passed/)

      const byPatient = await request(app)
        .post(`/api/me/bookings/${booking.body.id}/reschedule-request`)
        .set(asBob())
        .send({ proposedDate: '2020-01-06', proposedTime: '08:00' })

      expect(byPatient.status).toBe(400)
      expect(byPatient.body.error).toMatch(/already passed/)
    })

    it('cannot overbook a slot with a reschedule racing new bookings', async () => {
      // 09:00 on a weekday has one seat. A staff reschedule and several new
      // bookings all aim at it at once; the shared advisory lock must let
      // exactly one through.
      const date = await clinicDate(13)

      const moving = await request(app)
        .post('/api/bookings')
        .set(asBob())
        .send({
          serviceId,
          scheduledDate: await clinicDate(14),
          slotTime: '10:00',
          reasonForVisit: 'Will be moved',
        })
        .expect(201)

      const attempts = await Promise.all([
        request(app)
          .patch(`/api/bookings/${moving.body.id}/reschedule`)
          .set(asStaff())
          .send({ scheduledDate: date, slotTime: '09:00' }),
        ...Array.from({ length: 5 }, () =>
          request(app)
            .post('/api/bookings')
            .set(asAlice())
            .send({ serviceId, scheduledDate: date, slotTime: '09:00', reasonForVisit: 'Race' }),
        ),
      ])

      expect(attempts.filter((r) => r.status === 200 || r.status === 201)).toHaveLength(1)
      expect(attempts.filter((r) => r.status === 409)).toHaveLength(5)

      const availability = await request(app)
        .get(`/api/slots/availability?date=${date}`)
        .expect(200)

      expect(
        availability.body.find((s: { time: string }) => s.time === '09:00').booked,
      ).toBe(1)
    })
  })

  describe('reschedule is a request, not a move', () => {
    let bookingId: string
    let proposedDate: string

    beforeAll(async () => {
      proposedDate = await clinicDate(5)

      const res = await request(app)
        .post('/api/bookings')
        .set(asAlice())
        .send({
          serviceId,
          scheduledDate: await clinicDate(6),
          slotTime: '10:00',
          reasonForVisit: 'To be moved',
        })
        .expect(201)

      bookingId = res.body.id
    })

    it('leaves the original date and its held slot untouched', async () => {
      const before = await request(app)
        .get(`/api/bookings/${bookingId}`)
        .set(asStaff())
        .expect(200)

      await request(app)
        .post(`/api/me/bookings/${bookingId}/reschedule-request`)
        .set(asAlice())
        .send({ proposedDate, proposedTime: '11:00' })
        .expect(201)

      const after = await request(app)
        .get(`/api/bookings/${bookingId}`)
        .set(asStaff())
        .expect(200)

      // The app collects requests; it does not book appointments.
      expect(after.body.scheduledDate).toBe(before.body.scheduledDate)
      expect(after.body.slotTime).toBe(before.body.slotTime)
      expect(after.body.status).toBe(before.body.status)
    })

    it('allows only one open request per booking', async () => {
      const res = await request(app)
        .post(`/api/me/bookings/${bookingId}/reschedule-request`)
        .set(asAlice())
        .send({ proposedDate, proposedTime: '08:00' })

      expect(res.status).toBe(409)
      expect(res.body.error).toMatch(/already have a reschedule request/)
    })

    it('shows up in the staff queue and moves the booking on approval', async () => {
      const queue = await request(app)
        .get('/api/reschedule-requests')
        .set(asStaff())
        .expect(200)

      const pending = queue.body.find(
        (r: { bookingId: string }) => r.bookingId === bookingId,
      )

      // Denormalised so the queue renders "from → to" without a second lookup.
      expect(pending).toMatchObject({
        status: 'pending',
        proposedDate,
        proposedTime: '11:00',
        referenceNo: expect.stringMatching(/^BR-\d{4}$/),
        patientName: 'Alice A',
        currentDate: expect.any(String),
        currentTime: expect.any(String),
      })

      const approved = await request(app)
        .post(`/api/reschedule-requests/${pending.id}/approve`)
        .set(asStaff())
        .expect(200)

      expect(approved.body.status).toBe('approved')

      const booking = await request(app)
        .get(`/api/bookings/${bookingId}`)
        .set(asStaff())
        .expect(200)

      expect(booking.body.scheduledDate).toBe(proposedDate)
      expect(booking.body.slotTime).toBe('11:00')
      expect(booking.body.status).toBe('rescheduled')
    })

    /**
     * The one live use left for POST /confirm.
     *
     * Bookings arrive confirmed, so the endpoint is no longer part of that
     * flow — but a rescheduled appointment is one the clinic and the patient
     * have since agreed on, and settling it back to `confirmed` is a real
     * transition. Without this the endpoint would have no coverage at all and
     * would rot unnoticed.
     */
    it('settles a rescheduled booking back to confirmed', async () => {
      const settled = await request(app)
        .post(`/api/bookings/${bookingId}/confirm`)
        .set(asStaff())
        .expect(200)

      expect(settled.body.status).toBe('confirmed')
      // The agreed time survives the transition; confirming is not a revert.
      expect(settled.body.scheduledDate).toBe(proposedDate)
      expect(settled.body.slotTime).toBe('11:00')
    })

    it('refuses to decide the same request twice', async () => {
      const queue = await request(app)
        .get('/api/reschedule-requests?status=approved')
        .set(asStaff())
        .expect(200)

      const decided = queue.body.find(
        (r: { bookingId: string }) => r.bookingId === bookingId,
      )

      await request(app)
        .post(`/api/reschedule-requests/${decided.id}/decline`)
        .set(asStaff())
        .expect(409)
    })

    it('keeps the queue away from patients', async () => {
      await request(app).get('/api/reschedule-requests').set(asAlice()).expect(403)
    })
  })

  describe('staff status transitions', () => {
    let bookingId: string

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/bookings')
        .set(asBob())
        .send({
          serviceId,
          scheduledDate: await clinicDate(7),
          slotTime: '08:00',
          reasonForVisit: 'Status flow',
        })
        .expect(201)

      bookingId = res.body.id
    })

    /**
     * Confirming is not part of the booking flow any more.
     *
     * The booking arrives `confirmed`, so `POST /confirm` is a no-op the
     * transition guard rejects — `allowedFrom` is `['pending','rescheduled']`
     * and `confirmed` is neither. Asserting the 409 is what pins the behaviour:
     * without it, a future change reintroducing a confirmation step would pass
     * this file silently.
     */
    it('refuses to confirm a booking that arrived confirmed', async () => {
      const res = await request(app)
        .post(`/api/bookings/${bookingId}/confirm`)
        .set(asStaff())
        .expect(409)

      expect(res.body.error).toMatch(/confirmed appointment cannot be marked/i)
    })

    it('completes straight from confirmed', async () => {
      const completed = await request(app)
        .post(`/api/bookings/${bookingId}/complete`)
        .set(asStaff())
        .expect(200)

      expect(completed.body.status).toBe('completed')
    })

    it('will not resurrect a finished appointment', async () => {
      // Completed is terminal: confirming it again would tell the patient an
      // appointment they already attended is upcoming.
      await request(app)
        .post(`/api/bookings/${bookingId}/confirm`)
        .set(asStaff())
        .expect(409)

      await request(app)
        .delete(`/api/bookings/${bookingId}`)
        .set(asStaff())
        .expect(409)
    })

    it('finds a booking by its reference number', async () => {
      const booking = await request(app)
        .get(`/api/bookings/${bookingId}`)
        .set(asStaff())
        .expect(200)

      const found = await request(app)
        .get(`/api/bookings/reference/${booking.body.referenceNo}`)
        .set(asStaff())
        .expect(200)

      expect(found.body.id).toBe(bookingId)

      // Case-insensitive through upper-casing, not through ilike.
      await request(app)
        .get(`/api/bookings/reference/${booking.body.referenceNo.toLowerCase()}`)
        .set(asStaff())
        .expect(200)
    })

    it('treats % and _ in a reference literally', async () => {
      // With ilike, BR-% matched every booking, maybeSingle() errored on the
      // many rows, and the lookup became a 500.
      await request(app)
        .get(`/api/bookings/reference/${encodeURIComponent('BR-%')}`)
        .set(asStaff())
        .expect(404)

      await request(app)
        .get('/api/bookings/reference/BR-____')
        .set(asStaff())
        .expect(404)
    })
  })
})
