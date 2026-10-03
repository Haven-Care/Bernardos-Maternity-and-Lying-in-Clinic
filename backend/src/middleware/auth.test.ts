import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { getSupabaseClient } from '../config/supabase.js'
import {
  ADMIN_EMAIL,
  STAFF_EMAIL,
  STAFF_PASSWORD,
  signIn,
  signUpPatient,
  stackIsUp,
  uniqueEmail,
} from '../test/stack.js'

const app = createApp()
const up = await stackIsUp()

describe.skipIf(!up)('authorization', () => {
  let adminToken: string
  let staffToken: string
  let patientToken: string

  beforeAll(async () => {
    adminToken = await signIn(ADMIN_EMAIL, STAFF_PASSWORD)
    staffToken = await signIn(STAFF_EMAIL, STAFF_PASSWORD)
    const patient = await signUpPatient(
      uniqueEmail('patient'),
      'Sup3rSecret!',
      'Test Patient',
    )
    patientToken = patient.token
  })

  describe('GET /api/account/me', () => {
    it('returns the signed-in staff profile', async () => {
      const res = await request(app)
        .get('/api/account/me')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      // The shape is the contract's StaffProfile. If this drifts, every screen
      // reading the profile drifts with it.
      expect(res.body).toMatchObject({
        email: ADMIN_EMAIL,
        fullName: 'Hannah Puerta',
        role: 'administrator',
        status: 'active',
        employeeId: expect.stringMatching(/^EMP-\d{4}$/),
        twoFactorEnabled: false,
      })
      expect(res.body).toHaveProperty('lastLoginAt')
      expect(res.body).toHaveProperty('hiredAt')
    })

    it('rejects a request with no token', async () => {
      const res = await request(app).get('/api/account/me')
      expect(res.status).toBe(401)
    })

    it('rejects a malformed token', async () => {
      const res = await request(app)
        .get('/api/account/me')
        .set('Authorization', 'Bearer not-a-jwt')

      expect(res.status).toBe(401)
    })

    it('rejects a patient holding a perfectly valid token', async () => {
      // The token is genuine — GoTrue issued it. What a patient lacks is a
      // profiles row, and that is what decides the realm.
      const res = await request(app)
        .get('/api/account/me')
        .set('Authorization', `Bearer ${patientToken}`)

      expect(res.status).toBe(403)
    })
  })

  describe('GET /api/system/staff', () => {
    it('lets an administrator list staff', async () => {
      const res = await request(app)
        .get('/api/system/staff')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBeGreaterThanOrEqual(2)
    })

    it('refuses a non-administrator staff member', async () => {
      // The screen is unlisted, but that is not what stops them — this is.
      const res = await request(app)
        .get('/api/system/staff')
        .set('Authorization', `Bearer ${staffToken}`)

      expect(res.status).toBe(403)
    })

    it('refuses a patient', async () => {
      const res = await request(app)
        .get('/api/system/staff')
        .set('Authorization', `Bearer ${patientToken}`)

      expect(res.status).toBe(403)
    })

    it('refuses an anonymous request', async () => {
      const res = await request(app).get('/api/system/staff')
      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/system/staff', () => {
    it('provisions an account and returns its profile', async () => {
      const email = uniqueEmail('newstaff')

      const res = await request(app)
        .post('/api/system/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email,
          password: 'Sup3rSecret!',
          fullName: 'New Person',
          contactNumber: '0917 111 2222',
          role: 'staff',
        })

      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({ email, role: 'staff', status: 'active' })
    })

    it('rejects a duplicate email with a conflict', async () => {
      const res = await request(app)
        .post('/api/system/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: ADMIN_EMAIL,
          password: 'Sup3rSecret!',
          fullName: 'Impostor',
        })

      expect(res.status).toBe(409)
    })

    it('rejects a short password before it reaches GoTrue', async () => {
      const res = await request(app)
        .post('/api/system/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: uniqueEmail('weak'), password: 'abc', fullName: 'X' })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/8 characters/)
    })
  })

  describe('deactivation', () => {
    it('stops a token that was valid a moment ago', async () => {
      const email = uniqueEmail('doomed')

      const created = await request(app)
        .post('/api/system/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email, password: 'Sup3rSecret!', fullName: 'Soon Gone' })
        .expect(201)

      const token = await signIn(email, 'Sup3rSecret!')

      await request(app)
        .get('/api/account/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      await request(app)
        .patch(`/api/system/staff/${created.body.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'inactive' })
        .expect(200)

      // Same token, still cryptographically valid and unexpired. Authorization
      // reads the profiles row on every request, so revocation is immediate
      // rather than waiting an hour for the JWT to lapse.
      const after = await request(app)
        .get('/api/account/me')
        .set('Authorization', `Bearer ${token}`)

      expect(after.status).toBe(403)
    })

    it('will not let an administrator deactivate themselves', async () => {
      const me = await request(app)
        .get('/api/account/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const res = await request(app)
        .patch(`/api/system/staff/${me.body.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'inactive' })

      expect(res.status).toBe(400)
    })
  })

  describe('privilege escalation', () => {
    it('ignores user_type smuggled in through sign-up metadata', async () => {
      // signUp()'s `data` argument writes user_metadata, which the browser
      // fully controls. The realm is read from app_metadata, which it cannot
      // touch. This is the attack the split exists to stop.
      const { token, userId } = await signUpPatient(
        uniqueEmail('mallory'),
        'Sup3rSecret!',
        'Mallory',
        { user_type: 'staff', staff_role: 'administrator' },
      )

      await request(app)
        .get('/api/system/staff')
        .set('Authorization', `Bearer ${token}`)
        .expect(403)

      await request(app)
        .get('/api/account/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(403)

      // And they landed in the patient realm, not merely failed a role check.
      const { data } = await getSupabaseClient()
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle()

      expect(data).toBeNull()
    })
  })
})
