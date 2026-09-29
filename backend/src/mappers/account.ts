import type { Database } from '../db/types.js'
import type { NotificationPrefs, StaffProfile } from '../contract/account.js'

/**
 * Database rows are snake_case; the API contract is camelCase. Every domain has
 * a mapper like this one, and nothing outside `mappers/` reads a raw row.
 *
 * Explicit field-by-field rather than a generic key transformer: a renamed
 * column then fails the build here, in one obvious place, instead of silently
 * producing `undefined` on a screen.
 */

type ProfileRow = Database['public']['Tables']['profiles']['Row']
type PrefsRow = Database['public']['Tables']['notification_prefs']['Row']

export function toStaffProfile(row: ProfileRow): StaffProfile {
  return {
    id: row.id,
    fullName: row.full_name,
    employeeId: row.employee_id,
    role: row.role,
    status: row.status,
    contactNumber: row.contact_number,
    email: row.email,
    hiredAt: row.hired_at,
    lastLoginAt: row.last_login_at,
    avatarUrl: row.avatar_url,
    passwordChangedAt: row.password_changed_at,
    twoFactorEnabled: row.two_factor_enabled,
  }
}

export function toNotificationPrefs(row: PrefsRow): NotificationPrefs {
  return {
    emailNotifications: row.email_notifications,
    smsReminders: row.sms_reminders,
    newBookingAlerts: row.new_booking_alerts,
  }
}
