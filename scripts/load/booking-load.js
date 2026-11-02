/**
 * HavenCare load test: k6, against STAGING only.
 *
 *   k6 run scripts/load/booking-load.js
 *
 * Three things at once, for about four minutes:
 *
 *   browse  up to 50 patients reading slot availability, one click every
 *           20–40 s each, which is how the booking wizard is actually used
 *   race    every test patient account books the same slot at the same moment
 *   staff   a few portal sessions polling the dashboard, if staff credentials
 *           are given
 *
 * It passes when p95 latency stays under 800 ms, no request gets a 5xx, and
 * the contested slot ends with no more bookings than it had seats. Teardown
 * cancels every booking the race made, so staging is left as it was found.
 *
 * Everything comes from the environment; see docs/LOAD_TESTING.md for what to
 * create on staging first. The script never creates accounts.
 */
import http from 'k6/http'
import { check, fail, sleep } from 'k6'
import exec from 'k6/execution'
import { Counter } from 'k6/metrics'

const env = __ENV
const API = `${(env.BASE_URL || '').replace(/\/+$/, '')}/api`
const BOOKING_DATE = env.BOOKING_DATE
const STAFF = env.STAFF_EMAIL && env.STAFF_PASSWORD ? { email: env.STAFF_EMAIL, password: env.STAFF_PASSWORD } : null
const PATIENTS = (env.LOAD_PATIENTS || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => {
    const at = entry.indexOf(':')
    return { email: entry.slice(0, at), password: entry.slice(at + 1) }
  })

const serverErrors = new Counter('server_errors')
const rateLimited = new Counter('rate_limited')
const bookingsCreated = new Counter('bookings_created')
const overbooked = new Counter('overbooked')

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      exec: 'browse',
      stages: [
        { duration: '1m', target: 50 },
        { duration: '3m', target: 50 },
        { duration: '20s', target: 0 },
      ],
    },
    race: {
      executor: 'shared-iterations',
      exec: 'race',
      vus: Math.max(PATIENTS.length, 1),
      iterations: Math.max(PATIENTS.length, 1),
      startTime: '90s',
      maxDuration: '1m',
    },
    ...(STAFF && {
      staff: {
        executor: 'constant-vus',
        exec: 'staff',
        vus: 3,
        duration: '4m',
      },
    }),
  },
  thresholds: {
    'http_req_duration{expected_response:true}': ['p(95)<800'],
    server_errors: ['count==0'],
    overbooked: ['count==0'],
  },
}

function required(name) {
  if (!env[name]) fail(`Set ${name}. See docs/LOAD_TESTING.md.`)
  return env[name]
}

function record(res) {
  if (res.status >= 500) serverErrors.add(1)
  if (res.status === 429) rateLimited.add(1)
  return res
}

/** A GoTrue password sign-in, the same call the login page makes. */
function signIn({ email, password }) {
  const res = http.post(
    `${required('SUPABASE_URL').replace(/\/+$/, '')}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email, password }),
    { headers: { apikey: required('SUPABASE_PUBLISHABLE_KEY'), 'Content-Type': 'application/json' }, tags: { name: 'gotrue sign-in' } },
  )
  if (res.status !== 200) fail(`Sign-in failed for ${email}: HTTP ${res.status}.`)
  return res.json('access_token')
}

const authed = (token) => ({ headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })

function availability(date) {
  return record(http.get(`${API}/slots/availability?date=${date}`, { tags: { name: 'availability' } }))
}

export function setup() {
  if (env.CONFIRM_STAGING !== 'yes') {
    fail('This test books real slots. Point it at staging, then set CONFIRM_STAGING=yes.')
  }
  required('BASE_URL')
  required('BOOKING_DATE')
  if (PATIENTS.length < 2) fail('Set LOAD_PATIENTS to at least two email:password pairs, so there is a race.')

  // The contested slot: the first open one on the day with seats left.
  const slots = availability(BOOKING_DATE).json()
  const slot = slots.find((row) => row.isOpen && row.available > 0)
  if (!slot) fail(`No open slot with seats left on ${BOOKING_DATE}. Pick another BOOKING_DATE.`)
  if (slot.available >= PATIENTS.length) {
    console.warn(`The slot has ${slot.available} seats for ${PATIENTS.length} patients, so nobody loses the race. Add patients or pick a fuller slot.`)
  }

  const services = record(http.get(`${API}/services`, { tags: { name: 'services' } })).json()
  const service = services.find((row) => row.active)
  if (!service) fail('No active service to book.')

  const patients = PATIENTS.map((patient) => {
    const token = signIn(patient)
    // Bookings need the current privacy notice accepted, so accept it for any
    // account that has not, rather than failing every booking with a 428.
    const notice = record(http.get(`${API}/me/consent`, authed(token))).json()
    if (notice.required) {
      record(http.post(`${API}/me/consent`, JSON.stringify({ noticeVersion: notice.noticeVersion }), authed(token)))
    }
    return { email: patient.email, token }
  })

  return {
    patients,
    staffToken: STAFF ? signIn(STAFF) : null,
    slot: { time: slot.time },
    serviceId: service.id,
  }
}

export function browse() {
  const day = new Date(`${BOOKING_DATE}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() + Math.floor(Math.random() * 7))
  const res = availability(day.toISOString().slice(0, 10))
  check(res, { 'availability answered': (r) => r.status === 200 })
  sleep(20 + Math.random() * 20)
}

export function race(data) {
  const patient = data.patients[exec.scenario.iterationInTest % data.patients.length]
  const res = record(http.post(
    `${API}/bookings`,
    JSON.stringify({
      serviceId: data.serviceId,
      scheduledDate: BOOKING_DATE,
      slotTime: data.slot.time,
      reasonForVisit: 'Load test booking, cancelled automatically.',
    }),
    { ...authed(patient.token), tags: { name: 'book' } },
  ))
  if (res.status === 201) bookingsCreated.add(1)
  // Losing the race is a 409 with a message for the patient; anything else is
  // a fault.
  check(res, { 'booking won or cleanly refused': (r) => r.status === 201 || r.status === 409 })
}

export function staff(data) {
  for (const path of ['/dashboard/stats?range=today', '/dashboard/alerts', '/dashboard/appointments-overview?range=today']) {
    const res = record(http.get(`${API}${path}`, { ...authed(data.staffToken), tags: { name: path.split('?')[0] } }))
    check(res, { 'dashboard answered': (r) => r.status === 200 })
  }
  sleep(15)
}

export function teardown(data) {
  // Every seat the race filled, read back from the database rather than from
  // the responses: a double booking that returned 409 would still count here.
  const after = availability(BOOKING_DATE).json().find((row) => row.time === data.slot.time)
  if (after && after.booked > after.capacity) {
    overbooked.add(after.booked - after.capacity)
    console.error(`Overbooked: ${after.booked} bookings for ${after.capacity} seats at ${BOOKING_DATE} ${data.slot.time}.`)
  }

  for (const patient of data.patients) {
    const bookings = record(http.get(`${API}/me/bookings`, authed(patient.token))).json()
    for (const booking of bookings) {
      if (booking.scheduledDate === BOOKING_DATE && booking.slotTime === data.slot.time && booking.status !== 'cancelled') {
        record(http.del(`${API}/me/bookings/${booking.id}`, null, authed(patient.token)))
      }
    }
  }
}
