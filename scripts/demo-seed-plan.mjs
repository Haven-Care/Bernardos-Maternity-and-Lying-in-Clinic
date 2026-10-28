import { createHash } from 'node:crypto'

export const SEED_KEY = 'havencare-demo-20261028-v2'
export const ADMIN_EMAILS = ['berndo.clinic@gmail.com', 'havencare.org@gmail.com']

export function seedId(label) {
  const hex = createHash('sha256').update(`${SEED_KEY}:${label}`).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

export function addDays(date, offset) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + offset)
  return value.toISOString().slice(0, 10)
}

export function weekday(date) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`)).toLowerCase()
}

export function assertClientOwnership(existingUser, seedKey = SEED_KEY) {
  if (existingUser && (existingUser.app_metadata?.havencare_demo_seed !== seedKey || existingUser.app_metadata?.user_type !== 'patient')) {
    throw new Error('Refusing to change an existing account that is not owned by this demo seed.')
  }
}

export function assertAdminTarget(email) {
  if (!ADMIN_EMAILS.includes(email)) throw new Error('Administrator email is outside the explicitly requested allowlist.')
}

export function buildDemoPlan({ tables, projectHost, backupSha256, today, generatedAt = new Date().toISOString() }) {
  const services = tables.services.filter(service => service.active)
  if (!services.length) throw new Error('The source database has no active services.')
  const slots = tables.appointment_slots.filter(slot => slot.is_open && slot.capacity > 0)
    .sort((a, b) => a.slot_time.localeCompare(b.slot_time))
  if (!slots.length) throw new Error('The source database has no bookable slots.')
  const dailyCap = tables.clinic_settings[0]?.daily_booking_capacity ?? null
  const occupied = new Map()
  const daily = new Map()
  for (const booking of tables.appointments) {
    if (booking.status === 'cancelled') continue
    const key = `${booking.scheduled_date}/${booking.slot_time}`
    occupied.set(key, (occupied.get(key) || 0) + 1)
    daily.set(booking.scheduled_date, (daily.get(booking.scheduled_date) || 0) + 1)
  }
  function takeSeat(target, status, direction = 1) {
    for (let attempt = 0; attempt < 90; attempt++) {
      const date = addDays(target, attempt * direction)
      if (dailyCap !== null && (daily.get(date) || 0) >= dailyCap) continue
      for (const slot of slots.filter(item => item.weekday === weekday(date))) {
        const key = `${date}/${slot.slot_time}`
        if ((occupied.get(key) || 0) >= slot.capacity) continue
        if (status !== 'cancelled') {
          occupied.set(key, (occupied.get(key) || 0) + 1)
          daily.set(date, (daily.get(date) || 0) + 1)
        }
        return { scheduled_date: date, slot_time: slot.slot_time }
      }
    }
    throw new Error(`No free seat within the planning window for ${target}.`)
  }
  const clients = Array.from({ length: 5 }, (_, index) => ({
    key: `client-${String(index + 1).padStart(2, '0')}`,
    email: `client${String(index + 1).padStart(2, '0')}@havencare.test`,
    full_name: `Demo Client ${String(index + 1).padStart(2, '0')}`,
    contact_number: `0900000000${index + 1}`,
  }))
  const patients = [], reservations = [], clinicalRecords = [], statusEvents = [], rescheduleRequests = []
  const preferred = services.filter(service => /check.up|checkup/i.test(service.name))
  const availableServices = preferred.length ? preferred : services
  const history = [
    { key: 'completed-1', offset: -42, status: 'completed' },
    { key: 'completed-2', offset: -21, status: 'completed' },
    { key: 'cancelled', offset: -10, status: 'cancelled' },
    { key: 'no-show', offset: -7, status: 'no_show' },
    { key: 'upcoming-pending', offset: 1, status: 'pending' },
    { key: 'upcoming-booked', offset: 8, status: 'pending' },
  ]
  for (const [index, client] of clients.entries()) {
    const patientId = seedId(`${client.key}:patient`)
    patients.push({ id: patientId, client_key: client.key, full_name: client.full_name,
      email: client.email, contact_number: client.contact_number, date_of_birth: `${1992 + index}-05-14`,
      sex: 'female', civil_status: 'single', address: 'Synthetic demo address, Caloocan City',
      occupation: 'Demo record', blood_type: 'O+', last_menstrual_period: addDays(today, -70 - index * 7),
      expected_delivery_date: addDays(today, 210 - index * 7), gravida: 1, para: 0,
      attending_physician: 'Demo Clinician', allergies: 'Synthetic demo record',
      medical_conditions: `Synthetic demonstration only. Seed: ${SEED_KEY}`, visit_type: 'prenatal' })
    for (const [historyIndex, item] of history.entries()) {
      const service = availableServices[(index + historyIndex) % availableServices.length]
      const seat = takeSeat(addDays(today, item.offset), item.status, item.offset < 0 ? -1 : 1)
      const id = seedId(`${client.key}:${item.key}`)
      const marker = `[${SEED_KEY}:${client.key}:${item.key}]`
      const row = { id, client_key: client.key, patient_id: patientId,
        patient_name: client.full_name, contact_number: client.contact_number, email: client.email,
        service_id: service.id, service_name: service.name, ...seat, status: item.status,
        reason_for_visit: `${marker} Synthetic demonstration reservation.`,
        submitted_at: item.offset < 0 ? `${addDays(seat.scheduled_date, -3)}T09:00:00+08:00` : generatedAt }
      reservations.push(row)
      if (item.offset < 0) {
        const transitions = item.status === 'completed' ? [['pending', 'arrived'], ['arrived', 'completed']] : [['pending', item.status]]
        for (const [transitionIndex, [previous, next]] of transitions.entries()) {
          statusEvents.push({ id: seedId(`${client.key}:${item.key}:event:${next}`), booking_id: id,
            previous_status: previous, next_status: next,
            occurred_at: `${seat.scheduled_date}T${seat.slot_time}:00+08:00`, sequence: transitionIndex })
        }
      }
      if (item.status === 'completed') clinicalRecords.push({
        id: seedId(`${client.key}:${item.key}:clinical`), patient_id: patientId,
        occurred_at: `${seat.scheduled_date}T${seat.slot_time}:00+08:00`,
        title: `Demo consultation ${historyIndex + 1}`, findings: 'Synthetic demonstration record; no real clinical findings.',
        provider: 'Demo Clinician' })
      if (item.key === 'upcoming-booked' && index < 3) {
        const proposal = takeSeat(addDays(seat.scheduled_date, 2), 'cancelled')
        rescheduleRequests.push({ id: seedId(`${client.key}:reschedule`), booking_id: id,
          proposed_date: proposal.scheduled_date, proposed_time: proposal.slot_time,
          status: index === 2 ? 'declined' : 'pending', requested_at: generatedAt,
          decided_at: index === 2 ? generatedAt : null })
      }
    }
  }
  return {
    format: 'havencare-demo-seed-v1', seedKey: SEED_KEY, projectHost, sourceBackupSha256: backupSha256,
    today, generatedAt, admins: ADMIN_EMAILS.map((email, index) => ({ email,
      full_name: index === 0 ? 'Bernardo Admin' : 'HavenCare Admin', role: 'administrator' })),
    clients, patients, reservations, clinicalRecords, statusEvents, rescheduleRequests,
    masterData: Object.fromEntries(['clinic_info', 'clinic_settings', 'operating_hours', 'services', 'appointment_slots']
      .map(table => [table, tables[table]])),
  }
}
