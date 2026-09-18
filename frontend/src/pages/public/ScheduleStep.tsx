import { useEffect, useMemo } from 'react'
import type { SlotAvailability } from '../../types/slot'
import * as api from '../../api'
import { useAsync } from '../../hooks/useAsync'
import { AsyncBoundary, EmptyState } from '../../components/ui/states'
import { addDays, isoDate, today, weekdayOf } from '../../lib/dates'
import { formatTime } from '../../lib/format'

/**
 * How far ahead a patient may book. Two weeks is long enough to plan around and
 * short enough that the clinic isn't holding seats it can't staff.
 */
const WINDOW_DAYS = 14

/**
 * Step 2 — pick a date, then a time.
 *
 * **Booking opens tomorrow, not today.** Same-day requests are the ones staff
 * can't act on in time — a request submitted at 4 PM for an 8 AM slot that has
 * already passed is worse than no booking at all. Walk-ins stay a phone call,
 * which is what the clinic does now.
 *
 * Scheduling is capacity-based, matching `AppointmentSlot`: a fixed clock time
 * that holds N patients, not a duration to be subdivided. So the time list is a
 * short grid of the clinic's own slots, not a continuous picker.
 */
export function ScheduleStep({
  value,
  onChange,
}: {
  value: { scheduledDate: string; slotTime: string }
  onChange: (next: { scheduledDate: string; slotTime: string }) => void
}) {
  const dates = useMemo(
    () =>
      Array.from({ length: WINDOW_DAYS }, (_, i) =>
        isoDate(addDays(today(), i + 1)),
      ),
    [],
  )

  // Which weekdays the clinic opens at all — Sunday has no slots, so its chip is
  // disabled rather than leading to an empty list the patient has to interpret.
  const slots = useAsync(() => api.slots.listSlots())
  const openWeekdays = useMemo(
    () => new Set((slots.data ?? []).filter((s) => s.isOpen).map((s) => s.weekday)),
    [slots.data],
  )

  const bookable = useMemo(
    () => dates.filter((date) => openWeekdays.has(weekdayOf(date))),
    [dates, openWeekdays],
  )

  // Land on the first open day rather than an empty panel. Only ever fires when
  // nothing is chosen, so going back a step keeps the patient's own answer.
  useEffect(() => {
    if (!value.scheduledDate && bookable.length > 0) {
      onChange({ scheduledDate: bookable[0], slotTime: '' })
    }
  }, [bookable, value.scheduledDate, onChange])

  const availability = useAsync(
    () =>
      value.scheduledDate
        ? api.slots.listAvailability(value.scheduledDate)
        : Promise.resolve<SlotAvailability[]>([]),
    [value.scheduledDate],
  )

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900">
        When would you like to come in?
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Bookings open from tomorrow, up to {WINDOW_DAYS} days ahead.
      </p>

      <div
        className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-2"
        role="group"
        aria-label="Appointment date"
      >
        {dates.map((date) => {
          const open = openWeekdays.has(weekdayOf(date))
          const selected = value.scheduledDate === date

          return (
            <button
              key={date}
              type="button"
              disabled={!open}
              aria-pressed={selected}
              onClick={() => onChange({ scheduledDate: date, slotTime: '' })}
              className={`flex w-14 shrink-0 flex-col items-center gap-0.5 rounded-card border py-2 transition-colors ${
                selected
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : open
                    ? 'border-border bg-surface text-gray-700 hover:border-brand-300 hover:bg-brand-50/40'
                    : 'border-border bg-gray-50 text-gray-300'
              }`}
            >
              <span className="text-[10px] font-medium uppercase">
                {label(date, { weekday: 'short' })}
              </span>
              <span className="text-base leading-none font-semibold tabular-nums">
                {label(date, { day: 'numeric' })}
              </span>
              <span className="text-[10px]">{label(date, { month: 'short' })}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-4">
        <AsyncBoundary state={availability}>
          {(rows) => <SlotGrid rows={rows} value={value} onChange={onChange} />}
        </AsyncBoundary>
      </div>
    </div>
  )
}

function SlotGrid({
  rows,
  value,
  onChange,
}: {
  rows: SlotAvailability[]
  value: { scheduledDate: string; slotTime: string }
  onChange: (next: { scheduledDate: string; slotTime: string }) => void
}) {
  // Blocked slots are hidden outright — per the design's own note, blocking a
  // slot removes it from the public form immediately. A patient has no use for
  // the distinction between "blocked" and "not a time we offer".
  const offered = rows.filter((row) => row.isOpen)

  if (offered.length === 0) {
    return (
      <EmptyState
        title="No times on this day"
        description="Pick another date, or call the clinic if none of these work."
      />
    )
  }

  return (
    <div role="group" aria-label="Appointment time">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {offered.map((row) => {
          const left = row.capacity - row.booked
          const selected = value.slotTime === row.time

          return (
            <button
              key={row.id}
              type="button"
              disabled={!row.available}
              aria-pressed={selected}
              onClick={() =>
                onChange({ scheduledDate: value.scheduledDate, slotTime: row.time })
              }
              className={`rounded-card border px-3 py-2.5 text-center transition-colors ${
                selected
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : row.available
                    ? 'border-border bg-surface hover:border-brand-300 hover:bg-brand-50/40'
                    : 'border-border bg-gray-50 text-gray-400'
              }`}
            >
              <span className="block text-sm font-semibold">
                {formatTime(row.time)}
              </span>
              <span
                className={`block text-[11px] ${
                  selected ? 'text-white/80' : 'text-gray-400'
                }`}
              >
                {row.available
                  ? `${left} ${left === 1 ? 'slot' : 'slots'} left`
                  : 'Fully booked'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Locale pinned to en-PH, same reason as `lib/format` — this is a PH clinic. */
function label(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', options)
}
