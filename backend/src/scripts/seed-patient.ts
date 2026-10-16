/**
 * Create a confirmed demo patient with a linked clinical record and visit.
 * Run after the database migrations and supabase/seed.sql.
 *
 * Local: npm run seed:patient
 * Hosted: SEED_PATIENT_EMAIL=... SEED_PATIENT_PASSWORD=... npm run seed:patient
 *
 * Re-running fills missing demo data without duplicating the account or visit.
 */
import { env } from '../config/env.js'
import { getSupabaseClient } from '../config/supabase.js'

const LOCAL_EMAIL = 'demo.patient@havencare.test'
const LOCAL_PASSWORD = 'HavenCare!2026'
const NAME = 'Demo Patient'
const PHONE = '0917 000 0000'
const VISIT_REASON = 'HavenCare demo seed visit.'

function clinicDate(offsetDays = 0): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const part = (type: string) => parts.find((item) => item.type === type)!.value
  const date = new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

async function main() {
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(
    new URL(env.supabaseUrl).hostname,
  )
  const email = process.env.SEED_PATIENT_EMAIL?.trim().toLowerCase()
    ?? (isLocal ? LOCAL_EMAIL : undefined)
  const password = process.env.SEED_PATIENT_PASSWORD
    ?? (isLocal ? LOCAL_PASSWORD : undefined)

  if (!email || !password || password.length < 8) {
    throw new Error(
      'Hosted seeding requires SEED_PATIENT_EMAIL and SEED_PATIENT_PASSWORD ' +
        '(at least 8 characters).',
    )
  }
  if (!isLocal && (email === LOCAL_EMAIL || password === LOCAL_PASSWORD)) {
    throw new Error('Refusing to use the published local demo credentials on a hosted project.')
  }

  const db = getSupabaseClient()
  const { data: existing, error: lookupError } = await db.from('patient_accounts')
    .select('id').eq('email', email).maybeSingle()
  if (lookupError) throw lookupError

  let accountId = existing?.id
  if (accountId) {
    // Keep the requested demo credentials valid when the seed is rerun.
    const { error } = await db.auth.admin.updateUserById(accountId, { password })
    if (error) throw error
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: NAME, contact_number: PHONE },
    })
    if (error) throw error
    accountId = data.user.id
  }

  const { data: account, error: accountError } = await db.from('patient_accounts')
    .select('id').eq('id', accountId).maybeSingle()
  if (accountError) throw accountError
  if (!account) throw new Error('Auth user exists, but the patient account trigger did not run.')

  const { data: existingPatient, error: patientLookupError } = await db.from('patients')
    .select('id').eq('account_id', accountId).maybeSingle()
  if (patientLookupError) throw patientLookupError

  let patientId = existingPatient?.id
  if (!patientId) {
    const { data, error } = await db.from('patients').insert({
      account_id: accountId,
      full_name: NAME,
      contact_number: PHONE,
      email,
      date_of_birth: '1998-05-14',
      sex: 'female',
      civil_status: 'single',
      address: 'Demo address, Caloocan City',
      blood_type: 'O+',
      last_menstrual_period: clinicDate(-70),
      expected_delivery_date: clinicDate(210),
      gravida: 1,
      para: 0,
      attending_physician: 'Demo Clinician',
      allergies: 'None reported',
      medical_conditions: 'Synthetic demo record',
      visit_type: 'prenatal',
    }).select('id').single()
    if (error) throw error
    patientId = data.id
  }

  const { data: record, error: recordLookupError } = await db.from('clinical_records')
    .select('id').eq('patient_id', patientId).eq('title', 'Demo prenatal check-up')
    .maybeSingle()
  if (recordLookupError) throw recordLookupError
  if (!record) {
    const { error } = await db.from('clinical_records').insert({
      patient_id: patientId,
      occurred_at: `${clinicDate(-21)}T01:00:00Z`,
      title: 'Demo prenatal check-up',
      findings: 'Synthetic test data: routine prenatal review completed.',
      provider: 'Demo Clinician',
    })
    if (error) throw error
  }

  const { data: visit, error: visitLookupError } = await db.from('appointments')
    .select('id').eq('account_id', accountId).eq('reason_for_visit', VISIT_REASON)
    .maybeSingle()
  if (visitLookupError) throw visitLookupError
  if (!visit) {
    const { data: service, error: serviceError } = await db.from('services')
      .select('id, name').eq('name', 'Pre-natal Check-up').single()
    if (serviceError) throw serviceError
    const { error } = await db.from('appointments').insert({
      account_id: accountId,
      patient_id: patientId,
      patient_name: NAME,
      contact_number: PHONE,
      email,
      service_id: service.id,
      service_name: service.name,
      scheduled_date: clinicDate(-21),
      slot_time: '09:00',
      status: 'completed',
      reason_for_visit: VISIT_REASON,
      submitted_at: `${clinicDate(-22)}T01:00:00Z`,
    })
    if (error) throw error
  }

  console.log(`Demo patient ready: ${email}`)
  if (isLocal && !process.env.SEED_PATIENT_PASSWORD) {
    console.log(`Local password: ${LOCAL_PASSWORD}`)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
