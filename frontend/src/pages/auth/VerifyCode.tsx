import { ValidatedForm } from '../../components/ui/ValidatedForm'
import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import * as api from '../../api'
import { Button } from '../../components/ui/Button'
import { RecoveryShell } from './RecoveryShell'
import { CodeInput } from './CodeInput'
import { recoveryReturnTo, useAuthRealm } from './realm'

const CODE_LENGTH = 6

export function VerifyCode() {
  const navigate = useNavigate()
  const location = useLocation()
  const realm = useAuthRealm()
  const request = location.state as { email?: string; codeSentAt?: number } | null
  const email = request?.email
  const returnTo = recoveryReturnTo(location.state)
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])

  const [code, setCode] = useState('')
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState(request?.codeSentAt ? request.codeSentAt + 60_000 : 0)
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
  if (!email) return <Navigate to={returnTo ?? realm.forgotPath} replace />

  async function submit(value: string) {
    if (inFlight.current || value.length !== CODE_LENGTH || !/^\d+$/.test(value)) return
    inFlight.current = true
    setSubmitting(true)
    setError(undefined)

    try {
      await api.account.verifyResetCode(email!, value)
      if (active.current) navigate(returnTo ? '/patient/reset-password' : realm.resetPath, { state: { email, returnTo } })
    } catch (err) {
      if (active.current) setError(err instanceof Error ? err.message : 'That code didn’t work')
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
    <RecoveryShell
      title="Enter Verification Code"
      subtitle={`Enter the verification code sent to ${email}.`}
      returnTo={returnTo}
    >
      <ValidatedForm
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
          Enter the {CODE_LENGTH}-digit code sent to your email. If you don’t see it, check your spam folder.
        </p>
        {resendWait > 0 && <p role="status" className="text-center text-xs text-gray-500">Please wait before requesting another code.</p>}
        <button type="button" disabled={submitting || resending || resendWait > 0} onClick={() => void resend()} className="text-xs font-medium text-brand-600 disabled:text-gray-400">
          {resending ? 'Sending…' : resendWait > 0 ? `Resend in ${resendWait}s` : 'Resend code'}
        </button>

        <Button
          type="submit"
          loading={submitting}
          disabled={code.length !== CODE_LENGTH || resending}
          className="w-full"
        >
          Verify Code
        </Button>
      </ValidatedForm>
    </RecoveryShell>
  )
}
