import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import * as api from '../../api'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/fields'
import { AuthShell } from '../auth/AuthShell'

/**
 * Patient sign-in.
 *
 * A separate screen from the staff login rather than one form that branches:
 * the two say different things. This one offers a way to register, which the
 * staff screen must never do — staff accounts are provisioned, and a sign-up
 * link there would be an invitation to try.
 *
 * `from` comes from whichever guard redirected here, so a patient sent away
 * mid-booking returns to `/book` with their draft intact rather than landing on
 * a bookings list they did not ask for.
 */
export function PatientLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(undefined)

    try {
      await api.patientAuth.login(email, password)
      navigate(from ?? '/patient/bookings', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Sign in to book an appointment and see your bookings."
      footer={
        <p className="text-center text-xs text-gray-500">
          New here?{' '}
          <Link
            to="/patient/signup"
            state={from ? { from } : undefined}
            className="font-semibold text-brand-600 hover:underline"
          >
            Create an account
          </Link>
        </p>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="juana@gmail.com"
          autoComplete="username"
        />

        <div>
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="Enter your password"
            autoComplete="current-password"
          />
          <div className="mt-1.5 text-right">
            <Link
              to="/patient/forgot-password"
              className="text-xs text-brand-600 hover:text-brand-700 hover:underline"
            >
              Forgot Password?
            </Link>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger-700">
            {error}
          </p>
        )}

        <Button type="submit" loading={submitting} className="mt-1 w-full">
          Sign In
        </Button>
      </form>
    </AuthShell>
  )
}
