import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as api from '../api'
import { useAsync } from '../hooks/useAsync'
import { AuthShell } from '../pages/auth/AuthShell'
import { AuthLoadingScreen } from './ui/AuthLoadingScreen'
import { Button } from './ui/Button'
import { ErrorState } from './ui/states'

/**
 * Asks a signed-in patient to agree to the privacy notice in force before the
 * app shows or collects anything else.
 *
 * Reached by accounts made with Google, which skip the sign-up form's box, and
 * by everyone after the notice changes. A box ticked on the sign-up form is
 * recorded by the server on first sign-in, so those patients pass straight
 * through. Booking is refused server-side until this is done, so the gate is
 * the explanation, not the protection.
 */
export function ConsentGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const status = useAsync(() => api.privacy.getConsent())
  const [agreed, setAgreed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  if (status.loading) return <AuthLoadingScreen label="Checking your account…" />
  if (status.error || !status.data) {
    return <ErrorState error={status.error ?? new Error('Could not check your account.')} onRetry={status.reload} />
  }
  if (!status.data.required) return <>{children}</>

  const changed = status.data.consentedVersion !== null

  async function accept() {
    setSaving(true)
    setError(undefined)
    try {
      await api.privacy.acceptNotice()
      status.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your agreement. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function signOut() {
    await api.patientAuth.logout().catch(() => undefined)
    navigate('/patient/login', { replace: true })
  }

  return (
    <AuthShell
      title={changed ? 'Our privacy notice has changed' : 'Before you continue'}
      subtitle="Please read how the clinic handles your information."
    >
      <div className="flex flex-col gap-4 text-sm text-gray-700">
        <ul className="list-disc space-y-1 pl-5">
          <li>The clinic keeps your bookings and medical record to care for you, and for as long as the law requires.</li>
          <li>Only clinic staff who need it can see your record, and every access is logged.</li>
          <li>You can ask for a copy, a correction, or deletion at any time from your profile.</li>
        </ul>

        <Link to="/privacy" target="_blank" rel="noopener" className="w-fit font-semibold text-brand-600 hover:underline">
          Read the full Privacy Notice
        </Link>

        <label className="flex cursor-pointer items-start gap-3 rounded-card border border-brand-200 bg-brand-50/50 p-4">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-brand-600"
          />
          <span>
            I have read the Privacy Notice and agree to the clinic processing my personal and health information
            as it describes.
          </span>
        </label>

        {error && <p role="alert" className="text-sm text-danger-700">{error}</p>}

        <Button onClick={() => void accept()} loading={saving} disabled={!agreed} className="w-full justify-center">
          Agree and continue
        </Button>

        <p className="text-center text-xs text-gray-500">
          If you do not agree, you can{' '}
          <button type="button" onClick={() => void signOut()} className="font-semibold text-brand-600 hover:underline">
            sign out
          </button>
          . To have your information removed, contact the clinic.
        </p>
      </div>
    </AuthShell>
  )
}
