import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import * as api from '../../api'
import { Button } from '../../components/ui/Button'
import { PasswordField, TextField } from '../../components/ui/fields'
import { PasswordRules } from '../../components/ui/PasswordRules'
import { meetsPasswordRules } from '../../lib/password'
import { isEmail, isPhMobile } from '../../lib/validate'
import { AuthShell } from '../auth/AuthShell'

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

  const passwordOk = meetsPasswordRules(form.password)

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
          <PasswordField
            label="Password"
            required
            value={form.password}
            onChange={(password) => patch({ password })}
            placeholder="Create a password"
            autoComplete="new-password"
          />

          <div className="mt-2">
            <PasswordRules value={form.password} />
          </div>
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
