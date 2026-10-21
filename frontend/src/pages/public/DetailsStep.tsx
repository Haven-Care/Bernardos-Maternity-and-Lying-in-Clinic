import { useState } from 'react'
import type { Service } from '../../types/service'
import { Button } from '../../components/ui/Button'
import { TextArea, TextField } from '../../components/ui/fields'
import { formatDateLong, formatPeso, formatTime } from '../../lib/format'
import { isPhMobile } from '../../lib/validate'

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
  // The email is not validated because it is not entered. It comes from the
  // signed-in account and is shown read-only — see the field below.
  if (contact.reasonForVisit.trim().length < 5) {
    errors.reasonForVisit = 'Tell the clinic briefly why you’re coming in.'
  }

  return errors
}

/**
 * Step 3 — who is booking. Submission follows on the review screen.
 *
 * The chosen service and time are repeated at the top rather than hidden behind
 * a Back button, so a patient can catch a wrong choice before review.
 *
 * That repetition matters more now than it did. Submitting used to open a
 * request the clinic would confirm by phone, which gave a wrong date a chance
 * to be caught by a human; it books the slot outright today, so this summary is
 * the last point at which anyone checks.
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
  onContinue,
}: {
  value: Contact
  onChange: (patch: Partial<Contact>) => void
  service: Service
  scheduledDate: string
  slotTime: string
  onContinue: () => void
}) {
  const [errors, setErrors] = useState<Errors>({})

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const found = validate(value)
    setErrors(found)
    if (Object.keys(found).length === 0) onContinue()
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h1 className="text-lg font-semibold text-gray-900">Your details</h1>
      <p className="mt-1 text-sm text-gray-500">
        The clinic uses these to contact you about your appointment.
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

        {/*
          Read-only, not a text field.

          The server takes the email from the account behind the token and
          ignores anything sent in the body — that is what stops a booking being
          made under somebody else's address. An editable box whose contents are
          discarded would be a lie about what the form does, and the patient
          would only find out when the confirmation went to the other address.
        */}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-gray-700">
            Email address
          </span>
          <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
            {value.email}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            The clinic sends appointment emails to your account address.
          </p>
        </div>

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

      <Button
        type="submit"
        className="mt-5 w-full justify-center"
      >
        Review booking
      </Button>

      <p className="mt-3 text-center text-xs text-gray-500">
        You can check every detail before booking.
      </p>
    </form>
  )
}
