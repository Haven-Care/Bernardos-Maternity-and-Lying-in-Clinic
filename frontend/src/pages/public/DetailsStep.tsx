import { ValidatedForm } from '../../components/ui/ValidatedForm'
import { useState } from 'react'
import type { Service } from '../../types/service'
import { formatServicePrice } from '../../lib/services'
import { Button } from '../../components/ui/Button'
import { TextArea, TextField } from '../../components/ui/fields'
import { formatDateLong, formatTime } from '../../lib/format'
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
  savePersonalDetails,
  onSavePersonalDetailsChange,
  service,
  scheduledDate,
  slotTime,
  onContinue,
}: {
  value: Contact
  onChange: (patch: Partial<Contact>) => void
  savePersonalDetails: boolean
  onSavePersonalDetailsChange: (save: boolean) => void
  service: Service
  scheduledDate: string
  slotTime: string
  onContinue: () => void
}) {
  const [errors, setErrors] = useState<Errors>({})
  function change(patch: Partial<Contact>) {
    onChange(patch)
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !(key in patch))))
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const found = validate(value)
    setErrors(found)
    if (Object.keys(found).length === 0) onContinue()
  }

  return (
    <ValidatedForm onSubmit={handleSubmit} noValidate>
      <h1 className="text-lg font-semibold text-gray-900">Your details</h1>
      <p className="mt-1 text-sm text-gray-500">
        The clinic uses these to contact you about your appointment.
      </p>

      <dl className="mt-4 rounded-card border border-brand-200 bg-brand-50 p-4 text-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-3">
          <dt className="shrink-0 text-gray-600">Service</dt>
          <dd className="min-w-0 break-words font-semibold text-gray-900 sm:text-right">
            {service.name}{' '}
            <span className="font-normal text-gray-500">
              · {formatServicePrice(service.price)}
            </span>
          </dd>
        </div>
        <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-3">
          <dt className="shrink-0 text-gray-600">Date &amp; time</dt>
          <dd className="min-w-0 break-words font-semibold text-gray-900 sm:text-right">
            {formatDateLong(scheduledDate)}, {formatTime(slotTime)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
        <TextField validation="name"
          label="Full name"
          required
          value={value.patientName}
          onChange={(patientName) => change({ patientName })}
          placeholder="Juana Dela Cruz"
          autoComplete="name"
          error={errors.patientName}
        />

        <TextField validation="mobile" maxLength={30}
          label="Mobile number"
          required
          type="tel"
          value={value.contactNumber}
          onChange={(contactNumber) => change({ contactNumber })}
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
        <div className="min-w-0 sm:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-gray-700">
            Email address
          </span>
          <p className="break-all rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
            {value.email}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            The clinic uses your account email for appointment-related contact.
          </p>
        </div>

        <label className="flex min-w-0 cursor-pointer items-start gap-3 rounded-card border border-brand-200 bg-brand-50/50 p-4 sm:col-span-2">
          <input
            type="checkbox"
            checked={savePersonalDetails}
            onChange={(event) => onSavePersonalDetailsChange(event.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-brand-600"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-gray-900">Save my name and mobile number for future bookings</span>
            <span className="mt-1 block text-xs text-gray-600">Update my profile with these details after booking, so they’re filled in next time. Service, schedule, and reason for visit won’t be reused.</span>
          </span>
        </label>

        <div className="sm:col-span-2">
          <TextArea minLength={5}
            label="Reason for visit"
            required
            rows={3}
            value={value.reasonForVisit}
            onChange={(reasonForVisit) => change({ reasonForVisit })}
            placeholder="e.g. Routine monthly check-up"
            error={errors.reasonForVisit}
          />
        </div>
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
    </ValidatedForm>
  )
}
