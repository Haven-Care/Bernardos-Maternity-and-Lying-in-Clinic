import { useState } from 'react'
import * as api from '../../api'
import { useAsync } from '../../hooks/useAsync'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/toast-context'
import { ChangePasswordFields } from '../../components/ChangePasswordFields'
import {
  EMPTY_PASSWORD_CHANGE,
  isPasswordChangeReady,
  type PasswordChange,
} from '../../lib/password'
import { PublicShell } from '../public/PublicShell'

/**
 * The patient's account page, at `/patient/account`.
 *
 * Only Change Password for now. The email is shown but not editable — changing
 * it changes where sign-in and password resets go, which needs a confirmation
 * round trip rather than a text field (see `updateAccount`).
 */
export function Account() {
  const account = useAsync(() => api.patientAuth.getAccount())
  const toast = useToast()

  const [form, setForm] = useState<PasswordChange>(EMPTY_PASSWORD_CHANGE)
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const ready = isPasswordChangeReady(form)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!ready) return

    setSaving(true)
    setError(undefined)

    try {
      await api.patientAuth.changePassword({
        currentPassword: form.current,
        newPassword: form.next,
      })
      setForm(EMPTY_PASSWORD_CHANGE)
      toast.success(
        'Password changed',
        'Use your new password the next time you sign in.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PublicShell>
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Account</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {account.data
            ? `Signed in as ${account.data.email}`
            : 'Your sign-in details.'}
        </p>
      </div>

      <form
        className="mt-4 rounded-card border border-border bg-surface p-5"
        onSubmit={onSubmit}
      >
        <h2 className="text-base font-semibold text-gray-900">
          Change password
        </h2>

        <div className="mt-4">
          <ChangePasswordFields value={form} onChange={setForm} />
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-danger-700">
            {error}
          </p>
        )}

        <Button
          type="submit"
          loading={saving}
          disabled={!ready}
          className="mt-5 w-full justify-center"
        >
          Update password
        </Button>
      </form>
    </PublicShell>
  )
}
