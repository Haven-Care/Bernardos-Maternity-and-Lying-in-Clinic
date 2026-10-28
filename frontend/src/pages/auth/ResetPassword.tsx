import { ValidatedForm } from '../../components/ui/ValidatedForm'
import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import * as api from '../../api'
import { Button } from '../../components/ui/Button'
import { PasswordField } from '../../components/ui/fields'
import { PasswordRules } from '../../components/ui/PasswordRules'
import { meetsPasswordRules } from '../../lib/password'
import { RecoveryShell } from './RecoveryShell'
import { useAsync } from '../../hooks/useAsync'
import { ErrorState, LoadingState } from '../../components/ui/states'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'
import { recoveryReturnTo, useAuthRealm } from './realm'
import { useToast } from '../../components/ui/toast-context'

export function ResetPassword() {
  const navigate = useNavigate()
  const location = useLocation()
  const realm = useAuthRealm()
  const returnTo = recoveryReturnTo(location.state)
  const toast = useToast()
  const email = (location.state as { email?: string } | null)?.email
  const recovery = useAsync(() => api.account.recoveryEmail())

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  useUnsavedChanges((password !== '' || confirm !== '') && !submitting)

  if (recovery.loading) return <LoadingState label="Checking recovery session…" />
  if (recovery.error) return <ErrorState error={recovery.error} onRetry={recovery.reload} />

  // Landing here without a verified code — restart rather than let someone set
  // a password on an unverified address.
  if (!recovery.data || (email && email.toLowerCase() !== recovery.data.toLowerCase())) return <Navigate to={returnTo ?? realm.forgotPath} replace />

  const allPassed = meetsPasswordRules(password)
  const matches = password.length > 0 && password === confirm

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (!allPassed || !matches) {
      setError('Passwords don’t match')
      return
    }

    setSubmitting(true)
    setError(undefined)

    try {
      await api.account.resetPassword(password, !!returnTo)
      if (returnTo) toast.success('Password updated', 'Your new password has been saved. You’re still signed in.')
      navigate(returnTo ?? realm.successPath, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <RecoveryShell
      title="Create new password"
      subtitle="Your code has been confirmed. Choose a new password to finish resetting your account."
      returnTo={returnTo}
    >
      <ValidatedForm className="flex flex-col gap-4" onSubmit={onSubmit}>
        <PasswordField
          label="New Password"
          value={password}
          onChange={setPassword}
          placeholder="Enter new password"
          autoComplete="new-password"
        />

        <PasswordField
          label="Confirm New Password"
          value={confirm}
          onChange={setConfirm}
          placeholder="Re-enter new password"
          autoComplete="new-password"
          error={
            confirm.length > 0 && !matches ? 'Passwords don’t match' : undefined
          }
        />

        <PasswordRules value={password} />

        {error && (
          <p role="alert" className="text-sm text-danger-700">
            {error}
          </p>
        )}

        <Button
          type="submit"
          loading={submitting}
          disabled={!allPassed || !matches}
          className="w-full"
        >
          Reset Password
        </Button>
      </ValidatedForm>
    </RecoveryShell>
  )
}
