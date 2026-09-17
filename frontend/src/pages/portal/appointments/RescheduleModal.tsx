import { useState } from 'react'
import * as api from '../../../api'
import { useAsync } from '../../../hooks/useAsync'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { SelectField, TextField } from '../../../components/ui/fields'
import { formatTime } from '../../../lib/format'
import type { BookingRequest } from '../../../types/appointment'

/**
 * Reschedule Appointment — New Date, New Time.
 *
 * The time options come from the slot grid for whichever date is picked, not a
 * free text field: staff can only move a booking into a slot that exists and is
 * open. Full slots stay listed but disabled, so it's visible *why* a time isn't
 * available rather than the option silently missing.
 */
export function RescheduleModal({
  booking,
  open,
  onClose,
  onDone,
}: {
  booking: BookingRequest
  open: boolean
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [date, setDate] = useState(booking.scheduledDate)
  const [time, setTime] = useState(booking.slotTime)
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const availability = useAsync(
    () => api.slots.listAvailability(date),
    [date],
  )

  const options = (availability.data ?? []).map((slot) => {
    // This booking already occupies a seat in its own slot, so that slot reads
    // as full while still being a legal choice. Say so, otherwise "2/2 booked"
    // next to a selectable option looks like a bug.
    const isCurrent =
      slot.time === booking.slotTime && date === booking.scheduledDate

    const detail = !slot.isOpen
      ? 'blocked'
      : isCurrent
        ? 'current time'
        : `${slot.booked}/${slot.capacity} booked`

    return {
      value: slot.time,
      label: `${formatTime(slot.time)} — ${detail}`,
      disabled: !slot.available && !isCurrent,
    }
  })

  async function save() {
    setSaving(true)
    setError(undefined)

    try {
      await api.appointments.rescheduleBooking(booking.id, {
        scheduledDate: date,
        slotTime: time,
      })
      onDone('The appointment has been moved to the new date and time.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reschedule')
    } finally {
      setSaving(false)
    }
  }

  const noSlots = availability.data?.length === 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reschedule Appointment"
      description={`${booking.referenceNo} · ${booking.patientName}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => void save()}
            loading={saving}
            disabled={!time || noSlots}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          label="New Date"
          type="date"
          value={date}
          onChange={(next) => {
            setDate(next)
            // The new date has its own slot grid, so the held time may not
            // exist there. Clear it rather than submit a time that isn't offered.
            setTime('')
          }}
        />

        <SelectField
          label="New Time"
          value={time}
          onChange={setTime}
          options={options}
          placeholder={
            availability.loading
              ? 'Loading slots…'
              : noSlots
                ? 'No slots on this day'
                : 'Select a time'
          }
        />

        {noSlots && (
          <p className="text-xs text-gray-500">
            The clinic is closed on this day. Pick another date.
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-danger-700">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
