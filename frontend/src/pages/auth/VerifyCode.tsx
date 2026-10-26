import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import * as api from '../../api'
import { Button } from '../../components/ui/Button'
import { AuthShell, BackToLogin } from './AuthShell'
import { CodeInput } from './CodeInput'
import { useAuthRealm } from './realm'

const CODE_LENGTH = 8

export function VerifyCode() {
  const navigate = useNavigate()
  const location = useLocation()
  const realm = useAuthRealm()
  const email = (location.state as { email?: string } | null)?.email

  const [code, setCode] = useState('')
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [resending, setResending] = useState(false)
  const inFlight = useRef(false)
  const [resendWait, setResendWait] = useState(0)
  useEffect(() => {
    if (!cooldown) return
    const tick = () => setResendWait(Math.max(0, Math.ceil((cooldown - Date.now()) / 1000)))
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  // Reached directly, or after a refresh dropped the router state — there is no
  // address to verify against, so start the flow over rather than fail opaquely.
  if (!email) return <Navigate to={realm.forgotPath} replace />

  async function submit(value: string) {
    if (inFlight.current || value.length !== CODE_LENGTH || !/^\d+$/.test(value)) return
    inFlight.current = true
    setSubmitting(true)
    setError(undefined)

    try {
      await api.account.verifyResetCode(email!, value)
      navigate(realm.resetPath, { state: { email } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code didn’t work')
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  async function resend() {
    if (inFlight.current || Date.now() < cooldown) return
    inFlight.current = true
    setResending(true)
    setError(undefined)
    try {
      await api.account.requestPasswordReset(email!)
      setCode('')
      setCooldown(Date.now() + 60_000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the code')
    } finally {
      inFlight.current = false
      setResending(false)
    }
  }

  return (
    <AuthShell
      title="Enter Verification Code"
      subtitle={`Check ${email} for password recovery instructions.`}
      before={<BackToLogin to={realm.loginPath} />}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void submit(code)
        }}
      >
        <CodeInput
          value={code}
          length={CODE_LENGTH}
          onChange={setCode}
          // Submit as soon as the final digit lands — no reason to make someone
          // reach for the button once the code is complete.
          onComplete={(value) => void submit(value)}
        />

        {error && (
          <p role="alert" className="text-center text-sm text-danger-700">
            {error}
          </p>
        )}

        <p className="text-center text-xs text-gray-500">
          If an account exists, check its inbox and spam folder. Enter the {CODE_LENGTH}-digit code here, or open the reset link in the email.
        </p>
        {resendWait > 0 && <p role="status" className="text-center text-xs text-gray-500">New email requested. Please wait a minute before requesting another.</p>}
        <button type="button" disabled={submitting || resending || resendWait > 0} onClick={() => void resend()} className="text-xs font-medium text-brand-600 disabled:text-gray-400">
          {resending ? 'Sending…' : resendWait > 0 ? `Resend in ${resendWait}s` : 'Resend recovery email'}
        </button>

        <Button
          type="submit"
          loading={submitting}
          disabled={code.length !== CODE_LENGTH || resending}
          className="w-full"
        >
          Verify Code
        </Button>
      </form>
    </AuthShell>
  )
}
