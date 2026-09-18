import type { DateString, DateTimeString } from './common'

/** Observed: the prototype's profile shows Role "Administrator". */
export type StaffRole = 'administrator' | 'staff'

export type StaffStatus = 'active' | 'inactive'

/** Administration → My Account → Profile Details. */
export interface StaffProfile {
  id: string
  fullName: string
  /** e.g. `EMP-0001`. */
  employeeId: string
  role: StaffRole
  status: StaffStatus
  contactNumber: string
  email: string
  hiredAt: DateString
  lastLoginAt: DateTimeString
  avatarUrl: string | null
  passwordChangedAt: DateTimeString
  /**
   * The design shows a 2FA toggle. Supabase supports MFA, but enrollment and
   * challenge flows are real work — ship this visibly disabled rather than
   * faking it. See the plan.
   */
  twoFactorEnabled: boolean
}

/** Administration → My Account → Notification Preferences. */
export interface NotificationPrefs {
  /** Booking requests, reminders, and system alerts. */
  emailNotifications: boolean
  /**
   * Sent to patients before each appointment. Philippine SMS gateways bill per
   * message and there is no budget — ship disabled with a tooltip. Proposal
   * Limitation 2 already covers provider dependence.
   */
  smsReminders: boolean
  /** Notify me when a patient submits a request. */
  newBookingAlerts: boolean
}

export interface ProfileInput {
  fullName: string
  email: string
  contactNumber: string
}

export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
}

/**
 * The login form's field reads "username or email". Supabase Auth is email-only,
 * so the backend phase must either resolve a username to an email before
 * `signInWithPassword`, or this field becomes email-only.
 */
export interface LoginInput {
  identifier: string
  password: string
}
