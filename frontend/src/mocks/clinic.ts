import type {
  ClinicInfo,
  ClinicSettings,
  OperatingHours,
} from '../types/clinic'

/** Administration → Clinic Info, verbatim from the prototype. */
export const clinicInfo: ClinicInfo = {
  name: "Bernardo's Maternity & Lying-in Clinic",
  licenseNo: 'DOH-LTO-2025-00417',
  address: '123 Llano, Caloocan City',
  landline: '(02) 8123 4567',
  mobile: '0917 456 7890',
  email: 'bernardo1@havencare.ph',
  website: 'facebook.com/havencareclinic',
}

/**
 * The design groups Monday–Friday into one row rather than listing five, so the
 * table is keyed by label, not strictly by weekday.
 */
export const operatingHours: OperatingHours[] = [
  {
    key: 'monday',
    label: 'Monday – Friday',
    opensAt: '08:00',
    closesAt: '17:00',
    closed: false,
  },
  {
    key: 'saturday',
    label: 'Saturday',
    opensAt: '08:00',
    closesAt: '12:00',
    closed: false,
  },
  {
    key: 'sunday',
    label: 'Sunday',
    opensAt: null,
    closesAt: null,
    closed: true,
  },
  {
    key: 'holidays',
    label: 'Holidays',
    opensAt: null,
    closesAt: null,
    closed: true,
  },
]

export const clinicSettings: ClinicSettings = {
  nearExpiryDays: 30,
  reminderLeadHours: 24,
  dailyBookingCapacity: null,
}
