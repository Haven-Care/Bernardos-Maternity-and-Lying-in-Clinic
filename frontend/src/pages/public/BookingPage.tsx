import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { BookingRequest } from '../../types/appointment'
import type { Service } from '../../types/service'
import * as api from '../../api'
import { useAsync } from '../../hooks/useAsync'
import { Button } from '../../components/ui/Button'
import { LoadingState } from '../../components/ui/states'
import {
  clearDraftBooking,
  readDraftBooking,
  saveDraftBooking,
} from '../../lib/draftBooking'
import { BookingConfirmed } from './BookingConfirmed'
import { DetailsStep, type Contact } from './DetailsStep'
import { PublicShell } from './PublicShell'
import { ScheduleStep } from './ScheduleStep'
import { ServiceStep } from './ServiceStep'
import { Stepper, type BookingStep } from './Stepper'

/**
 * What the patient has actually typed.
 *
 * `undefined` means untouched, which is what separates "not filled in yet" from
 * "deliberately cleared". The account's name and number fill the gaps at render
 * time, so clearing a prefilled field leaves it cleared instead of springing
 * back on the next keystroke.
 */
type ContactEdits = Partial<Omit<Contact, 'email'>>

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
 *
 * **Steps 1 and 2 are public; step 3 requires an account.** Browsing services
 * and times is how a patient decides whether the clinic is worth registering
 * with, so demanding a sign-up before either would cost bookings. But the
 * booking itself hangs off an account — that is what makes My Bookings,
 * cancellation and reschedule requests possible at all, and what stops a slot
 * being held for an address nobody owns.
 *
 * The draft survives the sign-in round trip (see `lib/draftBooking`), so the
 * gate costs a patient their password and nothing else.
 */
export function BookingPage() {
  const navigate = useNavigate()

  /**
   * A booking parked by the sign-in gate, read once on mount.
   *
   * `sessionStorage` is synchronous, so this belongs in a lazy initialiser
   * rather than an effect — the draft is known before the first paint, and the
   * wizard opens on the right step instead of flashing step one and jumping.
   *
   * The read is pure and the clear happens in the effect below, because
   * StrictMode runs initialisers twice. If the session turns out to be gone,
   * the re-gate effect further down parks the choices again — it waits for the
   * account request, so it always runs after this clear.
   */
  const [draft] = useState(readDraftBooking)

  useEffect(() => {
    if (draft) clearDraftBooking()
  }, [draft])

  const [step, setStep] = useState<BookingStep>(draft ? 2 : 0)
  const [picked, setPicked] = useState<Service | null>(null)
  const [schedule, setSchedule] = useState({
    scheduledDate: draft?.scheduledDate ?? '',
    slotTime: draft?.slotTime ?? '',
  })
  const [edits, setEdits] = useState<ContactEdits>({})

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string>()
  const [confirmed, setConfirmed] = useState<BookingRequest>()

  // Null when signed out. The wizard runs either way — this only decides
  // whether Continue advances or diverts to sign-in, and what step 3 is
  // prefilled with.
  const account = useAsync(() => api.patientAuth.getAccount().catch(() => null))
  const services = useAsync(() => api.services.listActiveServices())

  /**
   * The chosen service, derived rather than stored.
   *
   * A draft carries a service *id*; step 3 needs the record to show the name
   * and price. Resolving it here instead of copying it into state on load
   * removes the effect that would otherwise have to wait for the fetch — and
   * with it the window where `step` says 3 and `service` is still null.
   */
  const service =
    picked ??
    (draft ? (services.data?.find((s) => s.id === draft.serviceId) ?? null) : null)

  // The service behind a draft can be deactivated while the patient is signing
  // up. Once the list is in and it is not there, the draft is unusable — start
  // over rather than show a summary naming something no longer offered.
  const draftServiceGone =
    draft !== null && picked === null && services.data !== undefined && !service

  const contact: Contact = {
    patientName: edits.patientName ?? account.data?.fullName ?? '',
    contactNumber: edits.contactNumber ?? account.data?.contactNumber ?? '',
    // Never edited — the server reads it from the account behind the token.
    email: account.data?.email ?? '',
    reasonForVisit: edits.reasonForVisit ?? '',
  }

  // On a phone the steps are taller than the viewport, so without this a patient
  // advancing from the date grid lands halfway down the form they just opened.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [step, confirmed])

  // The Details step needs an account, and `continueToDetails` is not the only
  // way onto it: a restored draft opens there directly. If the session behind
  // that draft has expired, or the email was never confirmed, park the choices
  // again and send the patient back through sign-in, rather than leave them on
  // a form with no email that can only fail on submit.
  const signedOutOnDetails =
    step === 2 && !account.loading && !account.data && service !== null

  useEffect(() => {
    if (!signedOutOnDetails || !service) return

    saveDraftBooking({
      serviceId: service.id,
      scheduledDate: schedule.scheduledDate,
      slotTime: schedule.slotTime,
    })
    navigate('/patient/login', { replace: true, state: { from: '/book' } })
  }, [signedOutOnDetails, service, schedule, navigate])

  // Stable so `ScheduleStep`'s auto-select effect doesn't re-fire every render.
  const handleSchedule = useCallback(
    (next: { scheduledDate: string; slotTime: string }) => setSchedule(next),
    [],
  )

  /**
   * The gate.
   *
   * Signed in, this is just "go to step 3". Signed out, the chosen service and
   * time are parked and the patient is sent to sign in with a `from` that
   * brings them straight back here.
   */
  function continueToDetails() {
    if (!service || !schedule.slotTime) return

    if (!account.data) {
      saveDraftBooking({
        serviceId: service.id,
        scheduledDate: schedule.scheduledDate,
        slotTime: schedule.slotTime,
      })
      navigate('/patient/login', { state: { from: '/book' } })
      return
    }

    setStep(2)
  }

  async function handleSubmit() {
    if (!service) return

    setSubmitting(true)
    setSubmitError(undefined)

    try {
      // The email is deliberately not sent: it comes from the signed-in
      // account, so a booking cannot be made under somebody else's address.
      // The name and number are passed as overrides for the day.
      const booking = await api.appointments.createBooking({
        patientName: contact.patientName,
        contactNumber: contact.contactNumber,
        reasonForVisit: contact.reasonForVisit,
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
    setPicked(null)
    setSchedule({ scheduledDate: '', slotTime: '' })
    setEdits({})
    setStep(0)
  }

  if (confirmed) {
    return (
      <PublicShell>
        <BookingConfirmed booking={confirmed} onBookAnother={reset} />
      </PublicShell>
    )
  }

  // Resolved after the fact rather than in `step`'s initialiser, because the
  // service list is not in yet at that point.
  const current: BookingStep = draftServiceGone ? 0 : step

  return (
    <PublicShell>
      <Stepper current={current} onJump={setStep} />

      <div className="rounded-card border border-border bg-surface p-5">
        {draftServiceGone && (
          <p
            role="alert"
            className="mb-4 rounded-card border border-warning-500/30 bg-warning-50 p-3 text-sm text-warning-700"
          >
            The service you picked is no longer offered. Please choose another.
          </p>
        )}

        {current === 0 && (
          <ServiceStep
            value={service?.id ?? ''}
            onPick={(next) => {
              // Changing the service doesn't invalidate a chosen slot — every
              // service uses the same slot grid — so the date survives.
              setPicked(next)
              setStep(1)
            }}
          />
        )}

        {current === 1 && (
          <ScheduleStep value={schedule} onChange={handleSchedule} />
        )}

        {current === 2 &&
          // Not until the account is known: the email is read from it, and a
          // signed-out patient is on their way to sign-in (see above).
          (service && account.data ? (
            <DetailsStep
              value={contact}
              onChange={(patch) => setEdits((e) => ({ ...e, ...patch }))}
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
          ) : (
            // Restoring a draft: the service list or the account is still in
            // flight.
            <LoadingState label="Picking up where you left off…" />
          ))}
      </div>

      {current > 0 && current < 2 && (
        <>
          <div className="mt-4 flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setStep((s) => (s - 1) as BookingStep)}
              className="flex-1 justify-center"
            >
              Back
            </Button>
            <Button
              onClick={continueToDetails}
              disabled={!schedule.slotTime}
              className="flex-1 justify-center"
            >
              Continue
            </Button>
          </div>

          {/*
            Said before the tap, not after. A patient who picks a time and only
            then discovers they need an account has already spent the effort
            they were deciding whether to spend.
          */}
          {!account.loading && !account.data && (
            <p className="mt-2.5 text-center text-xs text-gray-500">
              You’ll sign in on the next step — your choices are kept.
            </p>
          )}
        </>
      )}
    </PublicShell>
  )
}
