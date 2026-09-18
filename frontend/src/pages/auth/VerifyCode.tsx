import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import * as api from '../../api'
import { Button } from '../../components/ui/Button'
import { AuthShell, BackToLogin } from './AuthShell'
import { CodeInput } from './CodeInput'

export function VerifyCode() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = (location.state as { email?: string } | null)?.email

  const [code, setCode] = useState('')
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)
  const [resent, setResent] = useState(false)

  // Reached directly, or after a refresh dropped the router state — there is no
  // address to verify against, so start the flow over rather than fail opaquely.
  if (!email) return <Navigate to="/forgot-password" replace />

  async function submit(value: string) {
    setSubmitting(true)
    setError(undefined)

    try {
      await api.account.verifyResetCode(email!, value)
      navigate('/reset-password', { state: { email } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code didn’t work')
    } finally {
      setSubmitting(false)
    }
  }

  async function resend() {
    setError(undefined)
    try {
      await api.account.requestPasswordReset(email!)
      setResent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the code')
    }
  }

  return (
    <AuthShell
      title="Enter Verification Code"
      subtitle={`We sent a 6-digit code to ${email}. Enter it below to continue — you’ll set your new password on the next screen.`}
      before={<BackToLogin />}
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
          onChange={setCode}
          // Submit as soon as the sixth digit lands — no reason to make someone
          // reach for the button once the code is complete.
          onComplete={(value) => void submit(value)}
        />

        {error && (
          <p role="alert" className="text-center text-sm text-danger-700">
            {error}
          </p>
        )}

        <p className="text-center text-xs text-gray-400">
          {resent ? (
            'A new code is on its way.'
          ) : (
            <>
              Didn’t get a code?{' '}
              <button
                type="button"
                onClick={() => void resend()}
                className="font-medium text-brand-600 hover:underline"
              >
                Resend Code
              </button>
            </>
          )}
        </p>

        <Button
          type="submit"
          loading={submitting}
          disabled={code.length !== 6}
          className="w-full"
        >
          Verify Code
        </Button>
      </form>
    </AuthShell>
  )
}
