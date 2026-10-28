import { useMemo, useState } from 'react'
import * as api from '../../../api'
import { useAsync } from '../../../hooks/useAsync'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { AsyncBoundary } from '../../../components/ui/states'
import { formatDate, formatTime } from '../../../lib/format'
import { addDays, isoDate, startOfWeek, today, weekdayOf } from '../../../lib/dates'
import { validDate } from '../../../lib/dateRange'
import type { BookingRequest } from '../../../types/appointment'
import { BookingDetail } from './BookingDetail'

type CalendarView = 'month' | 'week' | 'day'
const VIEWS: CalendarView[] = ['month', 'week', 'day']
const VIEW_LABELS: Record<CalendarView, string> = { month: 'Month', week: 'Week', day: 'Day' }

function monthDays(date: Date): Date[] {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  const offset = (first.getDay() + 6) % 7
  const start = startOfWeek(first)
  return Array.from({ length: Math.ceil((offset + last.getDate()) / 7) * 7 }, (_, index) => addDays(start, index))
}

function moveDate(date: Date, view: CalendarView, direction: number): Date {
  if (view !== 'month') return addDays(date, direction * (view === 'week' ? 7 : 1))
  // Clamp January 31 to February's last day instead of overflowing into March.
  const next = new Date(date.getFullYear(), date.getMonth() + direction, 1)
  const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  next.setDate(Math.min(date.getDate(), last))
  return next
}

/** Month overview with day drill-down, plus week and day time grids. */
export function AppointmentCalendar() {
  const [view, setView] = useState<CalendarView>('week')
  const [anchor, setAnchor] = useState(today)
  const [selected, setSelected] = useState<BookingRequest | null>(null)
  const bookings = useAsync(() => api.appointments.listBookings())
  const slots = useAsync(() => api.slots.listSlots())

  const days = useMemo(() => {
    if (view === 'month') return monthDays(anchor)
    if (view === 'day') return [anchor]
    return Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(anchor), index))
  }, [anchor, view])
  const from = isoDate(days[0])
  const to = isoDate(days[days.length - 1])

  const visibleBookings = useMemo(() => (bookings.data ?? [])
    .filter((booking) => booking.status !== 'cancelled' && booking.scheduledDate >= from && booking.scheduledDate <= to)
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.slotTime.localeCompare(b.slotTime) || a.patientName.localeCompare(b.patientName)),
  [bookings.data, from, to])

  const byDay = useMemo(() => {
    const map = new Map<string, BookingRequest[]>()
    for (const booking of visibleBookings) {
      const list = map.get(booking.scheduledDate)
      if (list) list.push(booking)
      else map.set(booking.scheduledDate, [booking])
    }
    return map
  }, [visibleBookings])

  const times = useMemo(() => {
    const configured = (slots.data ?? []).filter((slot) => days.some((day) => weekdayOf(isoDate(day)) === slot.weekday))
    // Existing appointments remain visible even if their slot was later removed.
    return [...new Set([...configured.map((slot) => slot.time), ...visibleBookings.map((booking) => booking.slotTime)])].sort()
  }, [slots.data, visibleBookings, days])

  const monthLabel = anchor.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
  const heading = view === 'day'
    ? anchor.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : view === 'week' ? `${formatDate(from)} – ${formatDate(to)}` : monthLabel
  const todayIso = isoDate(today())
  const currentLabel = view === 'day' ? 'Today' : `This ${view}`
  const regionLabel = { month: 'Monthly', week: 'Weekly', day: 'Daily' }[view] + ' appointment calendar'

  function openDay(day: Date) {
    setAnchor(day)
    setView('day')
  }

  function chooseDate(value: string) {
    const date = view === 'month' ? `${value}-01` : value
    if (validDate(date)) setAnchor(new Date(`${date}T00:00:00`))
  }

  return (
    <>
      <Card>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="text-sm font-semibold text-gray-900">{heading}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Calendar view" className="flex gap-1 rounded-lg bg-gray-100 p-1">
              {VIEWS.map((option) => <Button key={option} size="sm" variant={view === option ? 'primary' : 'ghost'}
                aria-pressed={view === option} onClick={() => setView(option)}>{VIEW_LABELS[option]}</Button>)}
            </div>
            <label className="text-xs font-medium text-gray-600">
              {view === 'month' ? 'Month' : view === 'week' ? 'Week of' : 'Date'}
              <input type={view === 'month' ? 'month' : 'date'} aria-label={`Choose calendar ${view}`}
                value={view === 'month' ? isoDate(anchor).slice(0, 7) : view === 'week' ? from : isoDate(anchor)}
                onInput={(event) => chooseDate(event.currentTarget.value)} onChange={(event) => chooseDate(event.target.value)}
                className="ml-2 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm" />
            </label>
            <Button size="sm" variant="secondary" aria-label={`Previous ${view}`} onClick={() => setAnchor(moveDate(anchor, view, -1))}>Previous</Button>
            <Button size="sm" variant="secondary" onClick={() => setAnchor(today())}>{currentLabel}</Button>
            <Button size="sm" variant="secondary" aria-label={`Next ${view}`} onClick={() => setAnchor(moveDate(anchor, view, 1))}>Next</Button>
          </div>
        </header>

        <AsyncBoundary state={bookings}>
          {() => view === 'month' ? (
            <div role="region" aria-label={regionLabel} tabIndex={0} className="min-w-0 overflow-x-auto">
              <table className="w-full min-w-[820px] table-fixed border-collapse">
                <thead><tr>{days.slice(0, 7).map((day) => <th key={day.getDay()} scope="col"
                  className="border-b border-l border-border px-2 py-3 text-center text-xs font-medium text-gray-500 first:border-l-0">
                  {day.toLocaleDateString('en-PH', { weekday: 'short' })}
                </th>)}</tr></thead>
                <tbody>{Array.from({ length: days.length / 7 }, (_, week) => (
                  <tr key={week}>{days.slice(week * 7, week * 7 + 7).map((day) => {
                    const iso = isoDate(day)
                    const appointments = byDay.get(iso) ?? []
                    const inMonth = day.getMonth() === anchor.getMonth()
                    return <td key={iso} className={`h-36 border-b border-l border-border p-2 align-top first:border-l-0 ${inMonth ? '' : 'bg-gray-50'}`}>
                      <button type="button" aria-label={`View ${formatDate(iso)}`} onClick={() => openDay(day)}
                        className={`mb-2 flex size-7 items-center justify-center rounded-full text-xs font-semibold focus-visible:outline-2 focus-visible:outline-brand-500 ${iso === todayIso ? 'bg-brand-500 text-white' : inMonth ? 'text-gray-700 hover:bg-brand-50' : 'text-gray-400 hover:bg-gray-100'}`}>
                        <time dateTime={iso}>{day.getDate()}</time>
                      </button>
                      <div className="flex min-w-0 flex-col gap-1">
                        {appointments.slice(0, 3).map((booking) => <AppointmentChip key={booking.id} booking={booking} showTime onSelect={setSelected} />)}
                        {appointments.length > 3 && <button type="button" onClick={() => openDay(day)}
                          aria-label={`View all ${appointments.length} appointments on ${formatDate(iso)}`}
                          className="rounded px-1.5 py-1 text-left text-xs font-medium text-brand-700 hover:bg-brand-50">
                          +{appointments.length - 3} more
                        </button>}
                      </div>
                    </td>
                  })}</tr>
                ))}</tbody>
              </table>
            </div>
          ) : (
            <AsyncBoundary state={slots}>
              {() => <div role="region" aria-label={regionLabel} tabIndex={0} className="min-w-0 overflow-x-auto">
                {view === 'day' && visibleBookings.length === 0 && <p className="border-b border-border px-4 py-3 text-sm text-gray-500">No appointments for this day.</p>}
                <table className={`w-full table-fixed border-collapse ${view === 'week' ? 'min-w-[820px]' : ''}`}>
                  <colgroup><col className="w-20" /><col span={days.length} /></colgroup>
                  <thead><tr>
                    <th scope="col" className="border-b border-border px-2 py-2 text-xs font-medium text-gray-500">Time</th>
                    {days.map((day) => {
                      const iso = isoDate(day)
                      return <th key={iso} scope="col" className="border-b border-l border-border px-2 py-2 text-center">
                        <button type="button" aria-label={`View ${formatDate(iso)}`} onClick={() => openDay(day)}
                          className="rounded-md px-3 py-1 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-500">
                          <span className="block text-xs font-medium text-gray-400 uppercase">{day.toLocaleDateString('en-PH', { weekday: 'short' })}</span>
                          <time dateTime={iso} className={`mx-auto mt-0.5 flex size-6 items-center justify-center rounded-full text-sm font-semibold ${iso === todayIso ? 'bg-brand-500 text-white' : 'text-gray-700'}`}>{day.getDate()}</time>
                        </button>
                      </th>
                    })}
                  </tr></thead>
                  <tbody>
                    {times.map((time) => <tr key={time}>
                      <th scope="row" className="border-b border-border px-2 py-2 text-right align-top text-xs font-medium whitespace-nowrap text-gray-400">{formatTime(time)}</th>
                      {days.map((day) => <td key={isoDate(day)} className="h-16 border-b border-l border-border p-1 align-top">
                        <div className="flex min-w-0 flex-col gap-1">
                          {(byDay.get(isoDate(day)) ?? []).filter((booking) => booking.slotTime === time)
                            .map((booking) => <AppointmentChip key={booking.id} booking={booking} expanded={view === 'day'} onSelect={setSelected} />)}
                        </div>
                      </td>)}
                    </tr>)}
                    {times.length === 0 && <tr><td colSpan={days.length + 1} className="px-4 py-10 text-center text-sm text-gray-400">No appointment slots configured for this {view}.</td></tr>}
                  </tbody>
                </table>
              </div>}
            </AsyncBoundary>
          )}
        </AsyncBoundary>
      </Card>

      {selected && <BookingDetail booking={selected} open onClose={() => setSelected(null)} onChanged={bookings.reload} />}
    </>
  )
}

function AppointmentChip({ booking, showTime = false, expanded = false, onSelect }: {
  booking: BookingRequest
  showTime?: boolean
  expanded?: boolean
  onSelect: (booking: BookingRequest) => void
}) {
  return <button type="button" title={`${formatTime(booking.slotTime)} — ${booking.patientName} — ${booking.serviceName}`}
    onClick={() => onSelect(booking)}
    className={`w-full min-w-0 rounded px-1.5 py-1 text-left text-xs leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 ${CHIP[booking.status]}`}>
    <span className={`block font-semibold ${expanded ? 'break-words' : 'truncate'}`}>{showTime && `${formatTime(booking.slotTime)} · `}{booking.patientName}</span>
    <span className={`block opacity-80 ${expanded ? 'break-words' : 'truncate'}`}>{booking.serviceName}</span>
  </button>
}

const CHIP: Record<BookingRequest['status'], string> = {
  pending: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
  arrived: 'bg-success-50 text-success-700 hover:bg-success-100',
  no_show: 'bg-gray-100 text-gray-600 hover:bg-gray-200',
  rescheduled: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
  completed: 'bg-gray-100 text-gray-500 hover:bg-gray-200',
  cancelled: 'bg-gray-100 text-gray-500 hover:bg-gray-200',
}
