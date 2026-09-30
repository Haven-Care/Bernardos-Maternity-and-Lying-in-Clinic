import type { PasswordChange } from '../lib/password'
import { PasswordField } from './ui/fields'
import { PasswordRules } from './ui/PasswordRules'

/**
 * Current, new and confirm, with the rule checklist under the new one.
 *
 * Shared by the staff Change Password modal and the patient Account page, so
 * both realms are held to the same rules. The caller owns the state and the
 * submit, because one puts the button in a modal footer and the other does not.
 */
export function ChangePasswordFields({
  value,
  onChange,
}: {
  value: PasswordChange
  onChange: (value: PasswordChange) => void
}) {
  const mismatch = value.confirm !== '' && value.confirm !== value.next

  return (
    <div className="flex flex-col gap-4">
      <PasswordField
        label="Current Password"
        value={value.current}
        onChange={(current) => onChange({ ...value, current })}
        autoComplete="current-password"
      />
      <div className="flex flex-col gap-2">
        <PasswordField
          label="New Password"
          value={value.next}
          onChange={(next) => onChange({ ...value, next })}
          autoComplete="new-password"
        />
        <PasswordRules value={value.next} />
      </div>
      <PasswordField
        label="Confirm New Password"
        value={value.confirm}
        onChange={(confirm) => onChange({ ...value, confirm })}
        autoComplete="new-password"
        error={mismatch ? 'Passwords don’t match' : undefined}
      />
    </div>
  )
}
