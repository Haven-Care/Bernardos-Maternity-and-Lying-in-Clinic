import { useCallback, useEffect, useState } from 'react'
import type { BookingRequest } from '../../types/appointment'
import type { Service } from '../../types/service'
import * as api from '../../api'
import { Button } from '../../components/ui/Button'
import { BookingConfirmed } from './BookingConfirmed'
import { DetailsStep, type Contact } from './DetailsStep'
import { PublicShell } from './PublicShell'
import { ScheduleStep } from './ScheduleStep'
import { ServiceStep } from './ServiceStep'
import { Stepper, type BookingStep } from './Stepper'

const EMPTY_CONTACT: Contact = {
  patientName: '',
  contactNumber: '',
  email: '',
  reasonForVisit: '',
}

/**
 * The public booking form — the patient half of the product, at `/book`.
 *
 * **This screen has no Figma frame.** Every frame in the prototype is the staff
 * portal; the public form is referenced only in admin copy ("toggling a slot off
 * blocks it from the public booking form immediately"). It is built here against
 * the portal's established visual language — same brand colour, same primitives,
 * same card radius — so it reads as one product when the design does land.
 *
 * State lives in this component rather than in the router, unlike the password
 * reset sequence. That flow is genuinely four pages and needs a back button per
 * step; this is one form, and a patient who refreshes mid-booking should get a
 * clean start rather than a half-populated step three pointing at a slot that
 * may since have filled.
 */
export function BookingPage() {
  const [step, setStep] = useState<BookingStep>(0)
  const [service, setService] = useState<Service | null>(null)
  const [schedule, setSchedule] = useState({ scheduledDate: '', slotTime: '' })
  const [contact, setContact] = useState<Contact>(EMPTY_CONTACT)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string>()
  const [confirmed, setConfirmed] = useState<BookingRequest>()

  // On a phone the steps are taller than the viewport, so without this a patient
  // advancing from the date grid lands halfway down the form they just opened.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [step, confirmed])

  // Stable so `ScheduleStep`'s auto-select effect doesn't re-fire every render.
  const handleSchedule = useCallback(
    (next: { scheduledDate: string; slotTime: string }) => setSchedule(next),
    [],
  )

  async function handleSubmit() {
    if (!service) return

    setSubmitting(true)
    setSubmitError(undefined)

    try {
      const booking = await api.appointments.createBooking({
        ...contact,
        serviceId: service.id,
        scheduledDate: schedule.scheduledDate,
        slotTime: schedule.slotTime,
      })
      setConfirmed(booking)
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setConfirmed(undefined)
    setSubmitError(undefined)
    setService(null)
    setSchedule({ scheduledDate: '', slotTime: '' })
    setContact(EMPTY_CONTACT)
    setStep(0)
  }

  if (confirmed) {
    return (
      <PublicShell>
        <BookingConfirmed booking={confirmed} onBookAnother={reset} />
      </PublicShell>
    )
  }

  return (
    <PublicShell>
      <Stepper current={step} onJump={setStep} />

      <div className="rounded-card border border-border bg-surface p-5">
        {step === 0 && (
          <ServiceStep
            value={service?.id ?? ''}
            onPick={(picked) => {
              // Changing the service doesn't invalidate a chosen slot — every
              // service uses the same slot grid — so the date survives.
              setService(picked)
              setStep(1)
            }}
          />
        )}

        {step === 1 && (
          <ScheduleStep value={schedule} onChange={handleSchedule} />
        )}

        {step === 2 && service && (
          <DetailsStep
            value={contact}
            onChange={(patch) => setContact((c) => ({ ...c, ...patch }))}
            service={service}
            scheduledDate={schedule.scheduledDate}
            slotTime={schedule.slotTime}
            onSubmit={() => void handleSubmit()}
            submitting={submitting}
            error={submitError}
            onPickAnotherTime={() => {
              setSubmitError(undefined)
              setSchedule((s) => ({ ...s, slotTime: '' }))
              setStep(1)
            }}
          />
        )}
      </div>

      {step > 0 && step < 2 && (
        <div className="mt-4 flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setStep((s) => (s - 1) as BookingStep)}
            className="flex-1 justify-center"
          >
            Back
          </Button>
          <Button
            onClick={() => setStep(2)}
            disabled={!schedule.slotTime}
            className="flex-1 justify-center"
          >
            Continue
          </Button>
        </div>
      )}
    </PublicShell>
  )
}
