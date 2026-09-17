import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../../api'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/fields'
import { AuthShell, BackToLogin } from './AuthShell'

export function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(undefined)

    try {
      await api.account.requestPasswordReset(email)
      // Carry the address forward so the next two screens can use it without
      // re-asking. Lost on refresh, which is why VerifyCode guards for it.
      navigate('/verify-code', { state: { email } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the code')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Reset Password"
      subtitle="Enter your registered email and we’ll send you a 6-digit code to verify it’s you."
      before={<BackToLogin />}
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <TextField
          label="Email Address"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="Enter your email"
          autoComplete="email"
          error={error}
        />

        <Button type="submit" loading={submitting} className="w-full">
          Send
        </Button>
      </form>
    </AuthShell>
  )
}
