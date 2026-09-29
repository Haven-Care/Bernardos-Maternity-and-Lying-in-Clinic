import type { Database } from '../db/types.js'
import type {
  ClinicInfo,
  ClinicSettings,
  OperatingHours,
} from '../contract/clinic.js'
import type { Service } from '../contract/service.js'
import type { AppointmentSlot, SlotAvailability } from '../contract/slot.js'

type ClinicInfoRow = Database['public']['Tables']['clinic_info']['Row']
type ClinicSettingsRow = Database['public']['Tables']['clinic_settings']['Row']
type OperatingHoursRow = Database['public']['Tables']['operating_hours']['Row']
type ServiceRow = Database['public']['Tables']['services']['Row']
type SlotRow = Database['public']['Tables']['appointment_slots']['Row']
type AvailabilityRow =
  Database['public']['Functions']['slot_availability']['Returns'][number]

export function toClinicInfo(row: ClinicInfoRow): ClinicInfo {
  return {
    name: row.name,
    licenseNo: row.license_no,
    address: row.address,
    landline: row.landline,
    mobile: row.mobile,
    email: row.email,
    website: row.website,
  }
}

export function toClinicSettings(row: ClinicSettingsRow): ClinicSettings {
  return {
    nearExpiryDays: row.near_expiry_days,
    reminderLeadHours: row.reminder_lead_hours,
    dailyBookingCapacity: row.daily_booking_capacity,
  }
}

export function toOperatingHours(row: OperatingHoursRow): OperatingHours {
  return {
    key: row.key,
    label: row.label,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    closed: row.closed,
  }
}

export function toService(row: ServiceRow): Service {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    // numeric(10,2) arrives as a JSON number, but a string would slip through
    // typing and only show up as "₱NaN" on a price tag.
    price: Number(row.price),
    active: row.active,
  }
}

/** The contract calls this field `time`; the column is `slot_time`. */
export function toSlot(row: SlotRow): AppointmentSlot {
  return {
    id: row.id,
    weekday: row.weekday,
    time: row.slot_time,
    capacity: row.capacity,
    isOpen: row.is_open,
  }
}

export function toSlotAvailability(row: AvailabilityRow): SlotAvailability {
  return {
    id: row.id,
    weekday: row.weekday,
    time: row.slot_time,
    capacity: row.capacity,
    isOpen: row.is_open,
    booked: row.booked,
    available: row.available,
  }
}
