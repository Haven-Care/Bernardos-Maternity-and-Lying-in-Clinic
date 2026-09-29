import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { getSupabaseClient } from '../config/supabase.js'
import { env } from '../config/env.js'
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

describe.skipIf(!up)('patients and documents', () => {
  let staff: string
  let patientToken: string
  const auth = () => ({ Authorization: `Bearer ${staff}` })

  beforeAll(async () => {
    staff = await signIn(ADMIN_EMAIL, STAFF_PASSWORD)
    const p = await signUpPatient(uniqueEmail('p'), 'Sup3rSecret!', 'A Patient')
    patientToken = p.token
  })

  describe('records', () => {
    it('lists in the contract shape, with lastVisit derived', async () => {
      const res = await request(app).get('/api/patients').set(auth()).expect(200)

      expect(res.body.length).toBeGreaterThan(0)
      expect(res.body[0]).toEqual({
        id: expect.any(String),
        patientCode: expect.stringMatching(/^P-\d+$/),
        fullName: expect.any(String),
        contactNumber: expect.any(String),
        lastVisit: expect.anything(),
      })

      // Derived from the most recent completed appointment, not stored.
      const marian = res.body.find(
        (p: { patientCode: string }) => p.patientCode === 'P-108',
      )
      expect(marian.lastVisit).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('creates a record with only a name', async () => {
      // The minimum a booking supplies. A form demanding a blood type would
      // make first-booking materialisation impossible.
      const res = await request(app)
        .post('/api/patients')
        .set(auth())
        .send({ fullName: 'Minimal Record' })

      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({
        fullName: 'Minimal Record',
        dateOfBirth: null,
        sex: null,
        civilStatus: null,
        bloodType: null,
        lastVisit: null,
        // Empty string, not null — the contract types these as plain strings.
        address: '',
        allergies: '',
      })
      expect(res.body.patientCode).toMatch(/^P-\d+$/)
    })

    it('refuses para greater than gravida', async () => {
      const res = await request(app)
        .post('/api/patients')
        .set(auth())
        .send({ fullName: 'Impossible', gravida: 1, para: 3 })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/gravida/i)
    })

    it('round-trips an update', async () => {
      const created = await request(app)
        .post('/api/patients')
        .set(auth())
        .send({ fullName: 'To Be Edited' })
        .expect(201)

      const updated = await request(app)
        .patch(`/api/patients/${created.body.id}`)
        .set(auth())
        .send({
          fullName: 'Edited Name',
          sex: 'female',
          bloodType: 'O+',
          gravida: 2,
          para: 1,
          allergies: 'Penicillin',
        })
        .expect(200)

      expect(updated.body).toMatchObject({
        fullName: 'Edited Name',
        sex: 'female',
        bloodType: 'O+',
        gravida: 2,
        para: 1,
        allergies: 'Penicillin',
        // Unchanged by an update.
        patientCode: created.body.patientCode,
      })
    })

    it('leaves fields a PATCH does not mention alone', async () => {
      const created = await request(app)
        .post('/api/patients')
        .set(auth())
        .send({
          fullName: 'Partial Edit',
          allergies: 'Penicillin',
          bloodType: 'A+',
          gravida: 3,
          attendingPhysician: 'Dr. Reyes',
        })
        .expect(201)

      const updated = await request(app)
        .patch(`/api/patients/${created.body.id}`)
        .set(auth())
        .send({ contactNumber: '0917 555 0000' })
        .expect(200)

      // The create defaults used to apply here too, so this body wiped the
      // clinical fields to blank.
      expect(updated.body).toMatchObject({
        contactNumber: '0917 555 0000',
        allergies: 'Penicillin',
        bloodType: 'A+',
        gravida: 3,
        attendingPhysician: 'Dr. Reyes',
      })
    })

    it('400s an impossible date of birth', async () => {
      await request(app)
        .post('/api/patients')
        .set(auth())
        .send({ fullName: 'Bad Date', dateOfBirth: '1990-02-30' })
        .expect(400)
    })

    it('404s an unknown patient and 400s a malformed id', async () => {
      await request(app)
        .get('/api/patients/11111111-1111-4111-8111-111111111111')
        .set(auth())
        .expect(404)

      await request(app).get('/api/patients/nonsense').set(auth()).expect(400)
    })

    it('is staff-only — a patient cannot read the records', async () => {
      // Clinical records are not a screen the patient app has, and gravida and
      // allergies are not things to expose on a guess.
      await request(app).get('/api/patients').expect(401)
      await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(403)
    })
  })

  describe('documents', () => {
    let patientId: string

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/patients')
        .set(auth())
        .send({ fullName: 'Document Owner' })
        .expect(201)

      patientId = res.body.id
    })

    it('uploads through a signed URL and records the document', async () => {
      const bytes = Buffer.from('%PDF-1.4 pretend scan')

      const { body: signed } = await request(app)
        .post(`/api/patients/${patientId}/documents/upload-url`)
        .set(auth())
        .send({ fileName: 'valid-id.pdf' })
        .expect(200)

      expect(signed.path).toMatch(new RegExp(`^${patientId}/`))

      const put = await fetch(signed.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: bytes,
      })
      expect(put.ok).toBe(true)

      const doc = await request(app)
        .post(`/api/patients/${patientId}/documents`)
        .set(auth())
        .send({
          docType: 'valid_id',
          fileName: 'valid-id.pdf',
          fileSize: bytes.length,
          storagePath: signed.path,
        })
        .expect(201)

      expect(doc.body).toMatchObject({
        patientId,
        docType: 'valid_id',
        fileName: 'valid-id.pdf',
        fileSize: bytes.length,
        uploadedBy: 'Hannah Puerta',
      })

      const list = await request(app)
        .get(`/api/patients/${patientId}/documents`)
        .set(auth())
        .expect(200)

      expect(list.body).toHaveLength(1)
      // The storage path is an internal detail and must not leak to the client.
      expect(list.body[0]).not.toHaveProperty('storagePath')
    })

    it('refuses a storage path belonging to another patient', async () => {
      const other = await request(app)
        .post('/api/patients')
        .set(auth())
        .send({ fullName: 'Someone Else' })
        .expect(201)

      const res = await request(app)
        .post(`/api/patients/${patientId}/documents`)
        .set(auth())
        .send({
          docType: 'valid_id',
          fileName: 'stolen.pdf',
          fileSize: 10,
          storagePath: `${other.body.id}/forged-path.pdf`,
        })

      expect(res.status).toBe(400)
    })

    it('serves a signed link that works, where the raw path does not', async () => {
      const list = await request(app)
        .get(`/api/patients/${patientId}/documents`)
        .set(auth())
        .expect(200)

      const { url } = (
        await request(app)
          .get(`/api/documents/${list.body[0].id}/url`)
          .set(auth())
          .expect(200)
      ).body as { url: string }

      const signed = await fetch(url)
      expect(signed.ok).toBe(true)
      expect(await signed.text()).toContain('pretend scan')

      // The same object without the signature. This is the claim that matters:
      // these are medical records, and the bucket is private, so a guessed or
      // shared path is not a way in.
      const { data: row } = await getSupabaseClient()
        .from('patient_documents')
        .select('storage_path')
        .eq('id', list.body[0].id)
        .single()

      const raw = await fetch(
        `${env.supabaseUrl}/storage/v1/object/patient-documents/${row!.storage_path}`,
      )
      expect(raw.ok).toBe(false)
      expect([400, 401, 403, 404]).toContain(raw.status)
    })

    it('keeps documents staff-only', async () => {
      await request(app).get(`/api/patients/${patientId}/documents`).expect(401)
      await request(app)
        .get(`/api/patients/${patientId}/documents`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(403)
    })
  })

  describe('account', () => {
    it('updates the profile and returns the contract shape', async () => {
      const res = await request(app)
        .patch('/api/account/me')
        .set(auth())
        .send({
          fullName: 'Hannah Puerta',
          email: ADMIN_EMAIL,
          contactNumber: '0917 456 7890',
        })
        .expect(200)

      expect(res.body).toMatchObject({
        fullName: 'Hannah Puerta',
        email: ADMIN_EMAIL,
        contactNumber: '0917 456 7890',
        role: 'administrator',
      })
    })

    it('round-trips notification preferences', async () => {
      const before = await request(app)
        .get('/api/account/notifications')
        .set(auth())
        .expect(200)

      expect(before.body).toEqual({
        emailNotifications: expect.any(Boolean),
        smsReminders: expect.any(Boolean),
        newBookingAlerts: expect.any(Boolean),
      })

      const after = await request(app)
        .patch('/api/account/notifications')
        .set(auth())
        .send({ newBookingAlerts: false })
        .expect(200)

      expect(after.body.newBookingAlerts).toBe(false)
      // A partial update must not disturb the others.
      expect(after.body.emailNotifications).toBe(before.body.emailNotifications)

      await request(app)
        .patch('/api/account/notifications')
        .set(auth())
        .send({ newBookingAlerts: before.body.newBookingAlerts })
        .expect(200)
    })

    it('rejects an empty preferences patch', async () => {
      await request(app)
        .patch('/api/account/notifications')
        .set(auth())
        .send({})
        .expect(400)
    })
  })
})
