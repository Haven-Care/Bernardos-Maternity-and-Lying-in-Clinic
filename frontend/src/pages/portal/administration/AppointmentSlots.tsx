import { useState } from 'react'
import * as api from '../../../api'
import { useAsync } from '../../../hooks/useAsync'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Modal } from '../../../components/ui/Modal'
import { Toggle } from '../../../components/ui/Toggle'
import {
  NumberField,
  SelectField,
  TextField,
} from '../../../components/ui/fields'
import { Table, type Column } from '../../../components/ui/Table'
import { AsyncBoundary, EmptyState } from '../../../components/ui/states'
import { useToast } from '../../../components/ui/toast-context'
import { formatTime } from '../../../lib/format'
import { addDays, isoDate, startOfWeek, today } from '../../../lib/dates'
import { WEEKDAYS, type Weekday } from '../../../types/common'
import type { SlotAvailability } from '../../../types/slot'

const WEEKDAY_OPTIONS = WEEKDAYS.map((w) => ({
  value: w,
  label: w[0].toUpperCase() + w.slice(1),
}))

/**
 * Administration → Appointment Slots.
 *
 * "Booked Today" needs a concrete date to count against, so the weekday
 * selector is resolved to that weekday within the current week. Showing
 * occupancy for a weekday in the abstract would be meaningless.
 */
function dateForWeekday(weekday: Weekday): string {
  const index = WEEKDAYS.indexOf(weekday)
  return isoDate(addDays(startOfWeek(today()), index))
}

export function AppointmentSlots() {
  const [weekday, setWeekday] = useState<Weekday>(() => {
    const index = (today().getDay() + 6) % 7
    return WEEKDAYS[index]
  })
  const [adding, setAdding] = useState(false)

  const date = dateForWeekday(weekday)
  const slots = useAsync(() => api.slots.listAvailability(date), [date])
  const toast = useToast()

  async function toggleOpen(slot: SlotAvailability, isOpen: boolean) {
    await api.slots.setSlotOpen(slot.id, isOpen)
    slots.reload()
  }

  const columns: Column<SlotAvailability>[] = [
    {
      key: 'time',
      header: 'Time',
      render: (s) => (
        <span className="font-medium tabular-nums text-gray-900">
          {formatTime(s.time)}
        </span>
      ),
    },
    {
      key: 'capacity',
      header: 'Capacity',
      render: (s) => (
        <span className="tabular-nums">
          {s.capacity} {s.capacity === 1 ? 'patient' : 'patients'}
        </span>
      ),
    },
    {
      key: 'booked',
      header: 'Booked',
      align: 'right',
      render: (s) => (
        <span
          className={`tabular-nums ${s.booked >= s.capacity ? 'font-medium text-warning-700' : 'text-gray-600'}`}
        >
          {s.booked}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (s) => (
        <Badge
          tone={!s.isOpen ? 'neutral' : s.available ? 'success' : 'warning'}
        >
          {!s.isOpen ? 'Blocked' : s.available ? 'Open' : 'Full'}
        </Badge>
      ),
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (s) => (
        <Toggle
          checked={s.isOpen}
          onChange={(v) => void toggleOpen(s, v)}
          label={`${formatTime(s.time)} open`}
        />
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border p-4">
          <div className="w-44">
            <SelectField
              label="Weekday"
              value={weekday}
              onChange={(v) => setWeekday(v as Weekday)}
              options={WEEKDAY_OPTIONS}
            />
          </div>
          <Button size="sm" onClick={() => setAdding(true)}>
            + Add Time Slot
          </Button>
        </div>

        <p className="border-b border-border px-4 py-2.5 text-xs text-gray-500">
          Configure the time slots patients can choose from when booking online.
          Blocking a slot hides it from the booking form immediately — existing
          bookings in that slot are not affected.
        </p>

        <AsyncBoundary
          state={slots}
          empty={
            <EmptyState
              title="No slots on this day"
              description="The clinic is closed, or no times have been configured yet."
            />
          }
        >
          {(rows) => <Table columns={columns} rows={rows} rowKey={(s) => s.id} />}
        </AsyncBoundary>
      </Card>

      {adding && (
        <AddSlotModal
          weekday={weekday}
          open={adding}
          onClose={() => setAdding(false)}
          onSaved={() => {
            slots.reload()
            toast.success('Record Updated', 'The time slot has been added.')
          }}
          onError={(message) => toast.error('Could not add slot', message)}
        />
      )}
    </div>
  )
}

function AddSlotModal({
  weekday,
  open,
  onClose,
  onSaved,
  onError,
}: {
  weekday: Weekday
  open: boolean
  onClose: () => void
  onSaved: () => void
  onError: (message: string) => void
}) {
  const [time, setTime] = useState('')
  const [capacity, setCapacity] = useState<number | ''>(1)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await api.slots.createSlot({
        weekday,
        time,
        capacity: Number(capacity),
      })
      onSaved()
      onClose()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Add Time Slot"
      description={`Adds to ${weekday[0].toUpperCase() + weekday.slice(1)}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => void save()}
            loading={saving}
            disabled={time === '' || capacity === '' || capacity < 1}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          label="Time"
          type="time"
          required
          value={time}
          onChange={setTime}
        />
        <NumberField
          label="Capacity"
          required
          min={1}
          value={capacity}
          onChange={setCapacity}
          suffix="patients"
        />
      </div>
    </Modal>
  )
}
