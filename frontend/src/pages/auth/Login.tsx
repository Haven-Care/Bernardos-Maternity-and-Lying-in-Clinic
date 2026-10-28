import { ValidatedForm } from '../../components/ui/ValidatedForm'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import * as api from '../../api'
import { Button } from '../../components/ui/Button'
import { GoogleSignInButton } from '../../components/ui/GoogleSignInButton'
import { AuthLoadingScreen } from '../../components/ui/AuthLoadingScreen'
import { PasswordField, TextField } from '../../components/ui/fields'
import { loginDestination, loginErrorMessage } from '../../lib/login'
import { AuthShell } from './AuthShell'

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: unknown } | null)?.from
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)

  async function googleLogin(credential: string, nonce: string) {
    if (submitting || googleSubmitting) return
    setGoogleSubmitting(true)
    setError(undefined)
    try {
      const identity = await api.session.loginWithGoogle(credential, nonce)
      navigate(loginDestination(identity.role, from), { replace: true })
    } catch (err) {
      setError(loginErrorMessage(err))
      setGoogleSubmitting(false)
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting || googleSubmitting) return
    setSubmitting(true)
    setError(undefined)

    try {
      const identity = await api.session.login({ identifier, password })
      navigate(loginDestination(identity.role, from), { replace: true })
    } catch (err) {
      setError(loginErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <>
      {(submitting || googleSubmitting) && <AuthLoadingScreen label={googleSubmitting ? 'Signing in with Google…' : 'Signing you in…'} />}
      <div inert={submitting || googleSubmitting} aria-hidden={submitting || googleSubmitting || undefined}>
        <AuthShell title="Sign in" subtitle="Access your Bernardo Clinic account."
          footer={<p className="text-center text-xs text-gray-500">No account? <Link to="/patient/signup" state={typeof from === 'string' ? { from } : undefined} className="font-semibold text-brand-600 hover:underline">Create an account</Link></p>}>
          <ValidatedForm className="flex flex-col gap-4" onSubmit={onSubmit}>
            {/*
              The prototype labels this "username or email". It is email only.

              GoTrue authenticates on email, and accepting a username would mean an
              unauthenticated endpoint that turns a guessed username into an email —
              an oracle for enumerating the clinic's staff. Accounts here are
              provisioned and few, so a username earns nothing to pay for that.

              A field that accepts something it cannot use is worse than a renamed
              one, so the label matches the behaviour.
            */}
            <TextField
              label="Email"
              type="email"
              required
              value={identifier}
              onChange={setIdentifier}
              placeholder="you@example.com"
              autoComplete="username"
            />

            <div>
              <PasswordField
                label="Password"
                required
                value={password}
                onChange={setPassword}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              <div className="mt-1.5 text-right">
                <Link
                  to="/forgot-password"
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

            <Button type="submit" loading={submitting} disabled={googleSubmitting || !identifier.trim() || !password} className="mt-1 w-full">
              Log In
            </Button>
            {api.session.googleLoginEnabled && <GoogleSignInButton loading={googleSubmitting} disabled={submitting} onCredential={googleLogin} onError={() => setError('Google sign-in could not be completed. Please try again or use your email and password.')} />}
          </ValidatedForm>
        </AuthShell>
      </div>
    </>
  )
}
