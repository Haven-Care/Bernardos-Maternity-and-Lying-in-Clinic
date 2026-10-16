import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import * as api from '../../api'
import { Button } from '../../components/ui/Button'
import { PasswordField } from '../../components/ui/fields'
import { PasswordRules } from '../../components/ui/PasswordRules'
import { meetsPasswordRules } from '../../lib/password'
import { AuthShell, BackToLogin } from './AuthShell'
import { useAuthRealm } from './realm'

export function ResetPassword() {
  const navigate = useNavigate()
  const location = useLocation()
  const realm = useAuthRealm()
  const email = (location.state as { email?: string } | null)?.email

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  // Landing here without a verified code — restart rather than let someone set
  // a password on an unverified address.
  if (!email) return <Navigate to={realm.forgotPath} replace />

  const allPassed = meetsPasswordRules(password)
  const matches = password.length > 0 && password === confirm

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (!matches) {
      setError('Passwords don’t match')
      return
    }

    setSubmitting(true)
    setError(undefined)

    try {
      await api.account.resetPassword(password)
      navigate(realm.successPath, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Create new password"
      subtitle="Your code has been confirmed. Choose a new password to finish resetting your account."
      before={<BackToLogin to={realm.loginPath} />}
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
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
      </form>
    </AuthShell>
  )
}
