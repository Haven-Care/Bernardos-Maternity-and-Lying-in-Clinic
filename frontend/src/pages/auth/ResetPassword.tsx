import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import * as api from '../../api'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/fields'
import { AuthShell, BackToLogin } from './AuthShell'

/**
 * The rules the prototype lists under the password fields.
 *
 * Checked live as the user types rather than only on submit — the design shows
 * them as a standing checklist, which only makes sense if it reacts.
 */
const RULES: Array<{ label: string; test: (value: string) => boolean }> = [
  {
    label: 'Use at least 8 characters',
    test: (v) => v.length >= 8,
  },
  {
    label: 'Contains at least one uppercase letter (A–Z)',
    test: (v) => /[A-Z]/.test(v),
  },
  {
    label: 'Contains at least one number (0–9)',
    test: (v) => /\d/.test(v),
  },
  {
    label: 'Contains a special character (! @ # $)',
    test: (v) => /[^A-Za-z0-9]/.test(v),
  },
]

export function ResetPassword() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = (location.state as { email?: string } | null)?.email

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  // Landing here without a verified code — restart rather than let someone set
  // a password on an unverified address.
  if (!email) return <Navigate to="/forgot-password" replace />

  const results = RULES.map((rule) => ({
    ...rule,
    passed: rule.test(password),
  }))
  const allPassed = results.every((r) => r.passed)
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
      navigate('/reset-success', { replace: true })
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
      before={<BackToLogin />}
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <TextField
          label="New Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="Enter new password"
          autoComplete="new-password"
        />

        <TextField
          label="Confirm New Password"
          type="password"
          value={confirm}
          onChange={setConfirm}
          placeholder="Re-enter new password"
          autoComplete="new-password"
          error={
            confirm.length > 0 && !matches ? 'Passwords don’t match' : undefined
          }
        />

        <ul className="flex flex-col gap-1">
          {results.map((rule) => (
            <li
              key={rule.label}
              className={`flex items-center gap-1.5 text-xs ${
                rule.passed ? 'text-success-700' : 'text-gray-400'
              }`}
            >
              <svg
                className="size-3 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {rule.passed ? (
                  <path d="m5 13 4 4L19 7" />
                ) : (
                  <circle cx="12" cy="12" r="9" />
                )}
              </svg>
              {rule.label}
            </li>
          ))}
        </ul>

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
