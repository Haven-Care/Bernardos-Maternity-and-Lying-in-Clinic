import { useCallback, useState } from 'react'
import type { BookingRequest } from '../../types/appointment'
import * as api from '../../api'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { formatDateLong, formatTime } from '../../lib/format'
import { ScheduleStep } from '../public/ScheduleStep'

/**
 * Ask to move an appointment.
 *
 * **This does not move it.** The proposal goes to a staff queue and the
 * original booking keeps its date and its seat until someone approves.
 *
 * Booking is automatic and this is not, which is a distinction a patient will
 * not expect — so the copy says it in as many words, twice. Someone who books
 * instantly and assumes a reschedule works the same way is someone who turns up
 * on the wrong day, or not at all.
 *
 * The date and time picker is `ScheduleStep`, unchanged from the booking
 * wizard. Proposing a time the clinic does not offer, or one that is already
 * full, should be impossible in exactly the same way it is impossible when
 * booking — and a second picker would be a second place for that rule to drift.
 */
export function RescheduleRequestModal({
  booking,
  open,
  onClose,
  onRequested,
}: {
  booking: BookingRequest
  open: boolean
  onClose: () => void
  onRequested: () => void
}) {
  const [proposed, setProposed] = useState({ scheduledDate: '', slotTime: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>()

  // Stable, so ScheduleStep's auto-select effect doesn't re-fire every render.
  const handleChange = useCallback(
    (next: { scheduledDate: string; slotTime: string }) => setProposed(next),
    [],
  )

  async function submit() {
    if (!proposed.slotTime) return

    setSubmitting(true)
    setError(undefined)

    try {
      await api.myBookings.requestReschedule(booking.id, {
        proposedDate: proposed.scheduledDate,
        proposedTime: proposed.slotTime,
      })
      onRequested()
      onClose()
    } catch (err) {
      // The most likely rejection is a second open request on the same booking,
      // which the server answers with a 409 and a sentence saying so.
      setError(
        err instanceof Error ? err.message : 'Could not send your request.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request a different time"
      description={`Currently ${formatDateLong(booking.scheduledDate)}, ${formatTime(booking.slotTime)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Never mind
          </Button>
          <Button
            onClick={() => void submit()}
            loading={submitting}
            disabled={!proposed.slotTime}
          >
            Send request
          </Button>
        </>
      }
    >
      <ScheduleStep value={proposed} onChange={handleChange} />

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger-700">
          {error}
        </p>
      )}

      <p className="mt-4 rounded-card border border-warning-500/30 bg-warning-50 p-3 text-xs text-warning-700">
        Your appointment stays on{' '}
        <span className="font-semibold">
          {formatDateLong(booking.scheduledDate)},{' '}
          {formatTime(booking.slotTime)}
        </span>{' '}
        until the clinic approves this. Come in at that time unless they tell
        you otherwise.
      </p>
    </Modal>
  )
}
