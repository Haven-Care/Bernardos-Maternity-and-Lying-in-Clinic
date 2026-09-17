import type { NotificationPrefs, StaffProfile } from '../types/account'
import { daysFromToday, timestampFromToday } from './util'

/** The signed-in user shown throughout the prototype. */
export const profile: StaffProfile = {
  id: 'staff-1',
  fullName: 'Hannah Puerta',
  employeeId: 'EMP-0001',
  role: 'administrator',
  status: 'active',
  contactNumber: '0917 456 7890',
  email: 'hannahp@gmail.com',
  hiredAt: daysFromToday(-1400),
  lastLoginAt: timestampFromToday(0, '07:53'),
  avatarUrl: null,
  passwordChangedAt: timestampFromToday(-138, '09:00'),
  // Ships disabled — see the note on StaffProfile.twoFactorEnabled.
  twoFactorEnabled: false,
}

export const notificationPrefs: NotificationPrefs = {
  emailNotifications: true,
  smsReminders: false,
  newBookingAlerts: true,
}
