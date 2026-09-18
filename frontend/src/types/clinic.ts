import type { TimeString, Weekday } from './common'

/** Administration → Clinic Info → General Information. */
export interface ClinicInfo {
  name: string
  /** DOH licence to operate, e.g. `DOH-LTO-2025-00417`. */
  licenseNo: string
  address: string
  landline: string
  mobile: string
  email: string
  website: string
}

/**
 * One row of the Operating Hours table.
 *
 * The design groups Monday–Friday into a single row and adds a `holidays` row
 * alongside the weekdays, so this is keyed by a wider union than `Weekday`.
 */
export type OperatingHoursKey = Weekday | 'holidays'

export interface OperatingHours {
  key: OperatingHoursKey
  label: string
  opensAt: TimeString | null
  closesAt: TimeString | null
  closed: boolean
}

/**
 * Clinic-wide settings that aren't part of `ClinicInfo`.
 *
 * `dailyBookingCapacity` comes from the **pitch deck** ("Daily capacity limits"),
 * not the Figma — there is no screen for it yet. It is a separate ceiling from
 * per-slot `capacity`: a day can fill up before any individual slot does. Needs
 * a home in the Administration UI, or dropping if the client doesn't want it.
 */
export interface ClinicSettings {
  /** Days ahead of expiry a batch starts showing in Expiring Soon. */
  nearExpiryDays: number
  /** Hours before an appointment that a reminder is sent. */
  reminderLeadHours: number
  /** INFERRED — see note above. `null` means no daily ceiling. */
  dailyBookingCapacity: number | null
}
