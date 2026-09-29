// ---------------------------------------------------------------------------
// GENERATED — do not edit.
//
// Source: frontend/src/types/. Regenerate with `npm run sync:types`.
// Edit the frontend copy; it is the contract, and this is a mirror of it.
// ---------------------------------------------------------------------------

import type { DateString, DateTimeString } from './common.js'

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
 * The login form originally read "username or email". It is email-only:
 * GoTrue authenticates on email, and resolving a username would require an
 * unauthenticated lookup endpoint that tells anyone who asks whether a given
 * username exists. `identifier` keeps its name because every call site already
 * uses it; it carries an email address.
 */
export interface LoginInput {
  identifier: string
  password: string
}

/**
 * Staff provisioning — Administration → the unlisted `/admin/system` screen.
 *
 * There is no self sign-up on the admin side, so an account has to be created
 * by an administrator or by the seed script. Both go through the same endpoint.
 */
export interface CreateStaffInput {
  email: string
  password: string
  fullName: string
  contactNumber: string
  role: StaffRole
}
