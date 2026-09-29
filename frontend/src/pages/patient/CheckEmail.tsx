import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { AuthShell } from '../auth/AuthShell'

/**
 * The dead end after sign-up, and deliberately a dead end.
 *
 * `signUp` issues no session when confirmations are on, so there is nothing to
 * continue to — the next move is in the patient's inbox, not in this tab. A
 * screen that offered a "Continue" button here would lead straight to a login
 * that refuses the account, which reads as a broken sign-up rather than an
 * unread email.
 *
 * Confirmation is required because without it anyone could register an address
 * they do not own and book against it, and the clinic would hold a slot for
 * someone it cannot reach.
 */
export function CheckEmail() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { email?: string; from?: string } | null
  const email = state?.email

  // Reached directly, or after a refresh dropped the state. There is nothing to
  // say without an address, so send them back to the form.
  if (!email) return <Navigate to="/patient/signup" replace />

  return (
    <AuthShell title="" subtitle="">
      {/*
        No negative margin here. `AuthShell` renders nothing at all for an empty
        title, so pulling the content up only drags it into the logo block —
        which is exactly what it did, landing this icon on the clinic name.
      */}
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <svg
            className="size-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </span>

        <h1 className="text-lg font-semibold text-gray-900">Check your email</h1>
        <p className="text-sm text-gray-500">
          We sent a confirmation link to{' '}
          <span className="font-medium text-gray-700">{email}</span>. Open it to
          activate your account, then sign in.
        </p>
        <p className="text-xs text-gray-400">
          Nothing arrived? Check your spam folder — the clinic’s mail sometimes
          lands there.
        </p>

        <Button
          className="mt-3 w-full"
          onClick={() =>
            // `from` rides along, so confirming and signing in returns to the
            // booking the patient was part-way through rather than the list.
            navigate('/patient/login', {
              replace: true,
              state: state?.from ? { from: state.from } : undefined,
            })
          }
        >
          Go to sign in
        </Button>

        <Link
          to="/book"
          className="text-xs text-gray-400 transition-colors hover:text-gray-700"
        >
          Back to booking
        </Link>
      </div>
    </AuthShell>
  )
}
