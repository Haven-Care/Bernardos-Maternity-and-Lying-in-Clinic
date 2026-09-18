import { useState } from 'react'
import type { Service } from '../../types/service'
import { Button } from '../../components/ui/Button'
import { TextArea, TextField } from '../../components/ui/fields'
import { formatDateLong, formatPeso, formatTime } from '../../lib/format'
import { isEmail, isPhMobile } from '../../lib/validate'

export interface Contact {
  patientName: string
  contactNumber: string
  email: string
  reasonForVisit: string
}

type Errors = Partial<Record<keyof Contact, string>>

/**
 * Every message names the field and says what a good answer looks like.
 * "Invalid input" on a public form is how a booking gets abandoned.
 */
function validate(contact: Contact): Errors {
  const errors: Errors = {}

  if (contact.patientName.trim().length < 2) {
    errors.patientName = 'Enter your full name.'
  }
  if (!isPhMobile(contact.contactNumber)) {
    errors.contactNumber =
      'Enter a mobile number the clinic can reach you on, e.g. 0917 123 4567.'
  }
  if (!isEmail(contact.email)) {
    errors.email = 'Enter a valid email address, e.g. juan@gmail.com.'
  }
  if (contact.reasonForVisit.trim().length < 5) {
    errors.reasonForVisit = 'Tell the clinic briefly why you’re coming in.'
  }

  return errors
}

/**
 * Step 3 — who is booking, and the submit.
 *
 * The chosen service and time are repeated at the top rather than hidden behind
 * a Back button: this is the last screen before submitting, and a patient who
 * has to navigate away to check what they picked usually doesn't come back.
 *
 * Errors surface on submit, not on keystroke — validating a phone number while
 * it is still being typed flags every number as wrong for as long as it takes to
 * enter one.
 */
export function DetailsStep({
  value,
  onChange,
  service,
  scheduledDate,
  slotTime,
  onSubmit,
  submitting,
  error,
  onPickAnotherTime,
}: {
  value: Contact
  onChange: (patch: Partial<Contact>) => void
  service: Service
  scheduledDate: string
  slotTime: string
  onSubmit: () => void
  submitting: boolean
  /** A rejected submission — most often the slot filling up mid-form. */
  error?: string
  onPickAnotherTime: () => void
}) {
  const [errors, setErrors] = useState<Errors>({})

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const found = validate(value)
    setErrors(found)
    if (Object.keys(found).length === 0) onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h1 className="text-lg font-semibold text-gray-900">Your details</h1>
      <p className="mt-1 text-sm text-gray-500">
        The clinic uses these to confirm your appointment.
      </p>

      <dl className="mt-4 rounded-card border border-brand-200 bg-brand-50 p-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-gray-600">Service</dt>
          <dd className="text-right font-semibold text-gray-900">
            {service.name}{' '}
            <span className="font-normal text-gray-500">
              · {formatPeso(service.price)}
            </span>
          </dd>
        </div>
        <div className="mt-2 flex justify-between gap-3">
          <dt className="text-gray-600">Date &amp; time</dt>
          <dd className="text-right font-semibold text-gray-900">
            {formatDateLong(scheduledDate)}, {formatTime(slotTime)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 space-y-4">
        <TextField
          label="Full name"
          required
          value={value.patientName}
          onChange={(patientName) => onChange({ patientName })}
          placeholder="Juana Dela Cruz"
          autoComplete="name"
          error={errors.patientName}
        />

        <TextField
          label="Mobile number"
          required
          type="tel"
          value={value.contactNumber}
          onChange={(contactNumber) => onChange({ contactNumber })}
          placeholder="0917 123 4567"
          autoComplete="tel"
          error={errors.contactNumber}
        />

        <TextField
          label="Email address"
          required
          type="email"
          value={value.email}
          onChange={(email) => onChange({ email })}
          placeholder="juana@gmail.com"
          autoComplete="email"
          error={errors.email}
        />

        <TextArea
          label="Reason for visit"
          required
          rows={3}
          value={value.reasonForVisit}
          onChange={(reasonForVisit) => onChange({ reasonForVisit })}
          placeholder="e.g. Routine monthly check-up"
          error={errors.reasonForVisit}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="mt-5 rounded-card border border-danger-500/30 bg-danger-50 p-3 text-sm text-danger-700"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={onPickAnotherTime}
            className="mt-1.5 font-semibold underline underline-offset-2"
          >
            Choose another time
          </button>
        </div>
      )}

      <Button
        type="submit"
        loading={submitting}
        className="mt-5 w-full justify-center"
      >
        Request appointment
      </Button>

      <p className="mt-3 text-center text-xs text-gray-500">
        This sends a request. The clinic reviews it and confirms by text or
        email — it isn’t booked until they do.
      </p>
    </form>
  )
}
