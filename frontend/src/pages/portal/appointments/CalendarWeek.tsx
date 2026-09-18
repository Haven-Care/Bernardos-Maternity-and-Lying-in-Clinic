import { useMemo, useState } from 'react'
import * as api from '../../../api'
import { useAsync } from '../../../hooks/useAsync'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { AsyncBoundary } from '../../../components/ui/states'
import { formatTime } from '../../../lib/format'
import { addDays, isoDate, startOfWeek, today } from '../../../lib/dates'
import type { BookingRequest } from '../../../types/appointment'
import { BookingDetail } from './BookingDetail'

/**
 * The week grid — hour rows, day columns, patient chips.
 *
 * Rows come from the union of configured slot times across the week rather than
 * a fixed 8-to-5 range, so the grid stays correct if the clinic adds an evening
 * slot. Cancelled bookings are hidden: a cancelled appointment doesn't occupy
 * the room, and leaving it on the grid makes the day look busier than it is.
 */
export function CalendarWeek() {
  const [anchor, setAnchor] = useState(() => startOfWeek(today()))
  const [selected, setSelected] = useState<BookingRequest | null>(null)

  const bookings = useAsync(() => api.appointments.listBookings())
  const slots = useAsync(() => api.slots.listSlots())

  const days = useMemo(
    () => Array.from({ length: 6 }, (_, i) => addDays(anchor, i)),
    [anchor],
  )

  const times = useMemo(() => {
    const unique = new Set((slots.data ?? []).map((s) => s.time))
    return [...unique].sort()
  }, [slots.data])

  const byCell = useMemo(() => {
    const map = new Map<string, BookingRequest[]>()
    for (const booking of bookings.data ?? []) {
      if (booking.status === 'cancelled') continue
      const key = `${booking.scheduledDate}|${booking.slotTime}`
      const list = map.get(key)
      if (list) list.push(booking)
      else map.set(key, [booking])
    }
    return map
  }, [bookings.data])

  const monthLabel = anchor.toLocaleDateString('en-PH', {
    month: 'long',
    year: 'numeric',
  })
  const todayIso = isoDate(today())

  return (
    <>
      <Card>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="text-sm font-semibold text-gray-900">{monthLabel}</h2>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setAnchor(addDays(anchor, -7))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setAnchor(startOfWeek(today()))}
            >
              This week
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setAnchor(addDays(anchor, 7))}
            >
              Next
            </Button>
          </div>
        </header>

        <AsyncBoundary state={bookings}>
          {() => (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse">
                <thead>
                  <tr>
                    <th className="w-20 border-b border-border px-2 py-2" />
                    {days.map((day) => {
                      const iso = isoDate(day)
                      const isToday = iso === todayIso
                      return (
                        <th
                          key={iso}
                          scope="col"
                          className="border-b border-l border-border px-2 py-2 text-center"
                        >
                          <p className="text-[11px] font-medium text-gray-400 uppercase">
                            {day.toLocaleDateString('en-PH', {
                              weekday: 'short',
                            })}
                          </p>
                          <p
                            className={`mx-auto mt-0.5 flex size-6 items-center justify-center rounded-full text-sm font-semibold ${
                              isToday
                                ? 'bg-brand-500 text-white'
                                : 'text-gray-700'
                            }`}
                          >
                            {day.getDate()}
                          </p>
                        </th>
                      )
                    })}
                  </tr>
                </thead>

                <tbody>
                  {times.map((time) => (
                    <tr key={time}>
                      <th
                        scope="row"
                        className="border-b border-border px-2 py-2 text-right align-top text-[11px] font-medium whitespace-nowrap text-gray-400"
                      >
                        {formatTime(time)}
                      </th>

                      {days.map((day) => {
                        const iso = isoDate(day)
                        const cell = byCell.get(`${iso}|${time}`) ?? []

                        return (
                          <td
                            key={iso}
                            className="h-16 border-b border-l border-border p-1 align-top"
                          >
                            <div className="flex flex-col gap-1">
                              {cell.map((booking) => (
                                <button
                                  key={booking.id}
                                  type="button"
                                  onClick={() => setSelected(booking)}
                                  className={`w-full rounded px-1.5 py-1 text-left text-[11px] leading-tight transition-colors ${CHIP[booking.status] ?? CHIP.confirmed}`}
                                >
                                  <span className="block truncate font-semibold">
                                    {booking.patientName}
                                  </span>
                                  <span className="block truncate opacity-80">
                                    {booking.serviceName}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}

                  {times.length === 0 && (
                    <tr>
                      <td
                        colSpan={days.length + 1}
                        className="px-4 py-10 text-center text-sm text-gray-400"
                      >
                        No appointment slots configured yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </AsyncBoundary>
      </Card>

      {selected && (
        <BookingDetail
          booking={selected}
          open={selected !== null}
          onClose={() => setSelected(null)}
          onChanged={bookings.reload}
        />
      )}
    </>
  )
}

/**
 * Chips carry status as well as identity. Pending is amber so a request still
 * awaiting review is visible on the grid, not just in the requests tab.
 */
const CHIP: Record<string, string> = {
  pending: 'bg-warning-50 text-warning-700 hover:bg-warning-100',
  confirmed: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
  rescheduled: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
  completed: 'bg-gray-100 text-gray-500 hover:bg-gray-200',
}
