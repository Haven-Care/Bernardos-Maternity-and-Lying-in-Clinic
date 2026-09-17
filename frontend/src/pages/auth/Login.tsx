import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as api from '../../api'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/fields'
import { AuthShell } from './AuthShell'

export function Login() {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(undefined)

    try {
      await api.account.login({ identifier, password })
      navigate('/admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title="Welcome Back!" subtitle="Please sign in to access your account.">
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        {/*
          The prototype labels this "username or email", but Supabase Auth is
          email-only — wiring this needs either a `profiles.username` lookup or
          an email-only field. Flagged in types/account.ts; unresolved.
        */}
        <TextField
          label="Username"
          type="text"
          value={identifier}
          onChange={setIdentifier}
          placeholder="Enter your username or email"
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

        <Button type="submit" loading={submitting} className="mt-1 w-full">
          Log In
        </Button>
      </form>
    </AuthShell>
  )
}
