import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import * as api from '../../api'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/fields'
import { isEmail, isPhMobile } from '../../lib/validate'
import { AuthShell } from '../auth/AuthShell'

/**
 * The same checklist the password-reset screen shows, for the same reason —
 * a rule the user can only discover by failing is a rule that gets failed.
 */
const RULES: Array<{ label: string; test: (value: string) => boolean }> = [
  { label: 'Use at least 8 characters', test: (v) => v.length >= 8 },
  { label: 'Contains at least one uppercase letter (A–Z)', test: (v) => /[A-Z]/.test(v) },
  { label: 'Contains at least one number (0–9)', test: (v) => /\d/.test(v) },
  { label: 'Contains a special character (! @ # $)', test: (v) => /[^A-Za-z0-9]/.test(v) },
]

interface Form {
  fullName: string
  email: string
  contactNumber: string
  password: string
}

type Errors = Partial<Record<keyof Form, string>>

function validate(form: Form): Errors {
  const errors: Errors = {}

  if (form.fullName.trim().length < 2) errors.fullName = 'Enter your full name.'
  if (!isEmail(form.email)) {
    errors.email = 'Enter a valid email address, e.g. juana@gmail.com.'
  }
  if (!isPhMobile(form.contactNumber)) {
    errors.contactNumber =
      'Enter a mobile number the clinic can reach you on, e.g. 0917 123 4567.'
  }

  return errors
}

/**
 * Register.
 *
 * **This creates a login, not a patient record.** The clinical record — gravida,
 * para, last menstrual period, attending physician — is materialised at the
 * first booking and completed by staff at the visit. Asking for any of it here
 * would be asking a stranger on a phone for information they do not have, and
 * would fill Patient Records with rows for people who never came in.
 *
 * So the form collects exactly what someone can answer about themselves: who
 * they are, how to reach them, and a password.
 *
 * Nothing typed here can make the account staff. The realm is read from
 * `app_metadata`, which only the service_role key can write; the `data` this
 * form sends lands in `user_metadata`, which is why the two are kept apart.
 */
export function SignUp() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  const [form, setForm] = useState<Form>({
    fullName: '',
    email: '',
    contactNumber: '',
    password: '',
  })
  const [errors, setErrors] = useState<Errors>({})
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  const patch = (next: Partial<Form>) => setForm((f) => ({ ...f, ...next }))

  const results = RULES.map((rule) => ({ ...rule, passed: rule.test(form.password) }))
  const passwordOk = results.every((r) => r.passed)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()

    const found = validate(form)
    setErrors(found)
    if (Object.keys(found).length > 0 || !passwordOk) return

    setSubmitting(true)
    setError(undefined)

    try {
      await api.patientAuth.signUp(form)
      // No session yet — confirmation is required before the account can book.
      // The address is carried forward only so the next screen can name it.
      navigate('/patient/check-email', {
        replace: true,
        state: { email: form.email.trim().toLowerCase(), from },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="You’ll need an account to book an appointment."
      footer={
        <p className="text-center text-xs text-gray-500">
          Already registered?{' '}
          <Link
            to="/patient/login"
            state={from ? { from } : undefined}
            className="font-semibold text-brand-600 hover:underline"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <TextField
          label="Full name"
          required
          value={form.fullName}
          onChange={(fullName) => patch({ fullName })}
          placeholder="Juana Dela Cruz"
          autoComplete="name"
          error={errors.fullName}
        />

        <TextField
          label="Email address"
          required
          type="email"
          value={form.email}
          onChange={(email) => patch({ email })}
          placeholder="juana@gmail.com"
          autoComplete="email"
          error={errors.email}
        />

        <TextField
          label="Mobile number"
          required
          type="tel"
          value={form.contactNumber}
          onChange={(contactNumber) => patch({ contactNumber })}
          placeholder="0917 123 4567"
          autoComplete="tel"
          error={errors.contactNumber}
        />

        <div>
          <TextField
            label="Password"
            required
            type="password"
            value={form.password}
            onChange={(password) => patch({ password })}
            placeholder="Create a password"
            autoComplete="new-password"
          />

          <ul className="mt-2 flex flex-col gap-1">
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
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger-700">
            {error}
          </p>
        )}

        <Button
          type="submit"
          loading={submitting}
          disabled={!passwordOk}
          className="mt-1 w-full"
        >
          Create Account
        </Button>
      </form>
    </AuthShell>
  )
}
