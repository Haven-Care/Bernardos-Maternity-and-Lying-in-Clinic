import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { calendarDays, clinicDate, dateRangeError, orderedDateRange, validDate, type DateRange } from '../../lib/dateRange'
import { formatDate } from '../../lib/format'
import { Button } from './Button'
import { Modal } from './Modal'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function rangeLabel(value: DateRange): string {
  if (dateRangeError(value)) return 'Choose dates'
  if (value.from && value.to) return `${formatDate(value.from)} – ${formatDate(value.to)}`
  if (value.from) return `From ${formatDate(value.from)}`
  if (value.to) return `Until ${formatDate(value.to)}`
  return 'All dates'
}

function moveDate(day: string, days: number, months = 0): string {
  const date = new Date(`${day}T00:00:00Z`)
  if (months) {
    const originalDay = date.getUTCDate()
    date.setUTCDate(1)
    date.setUTCMonth(date.getUTCMonth() + months)
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
    date.setUTCDate(Math.min(originalDay, last))
  }
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function DateRangeFields({ value, onChange, required = false }: { value: DateRange; onChange: (range: DateRange) => void; required?: boolean }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)
  const error = dateRangeError(value)

  useEffect(() => {
    if (!open && wasOpen.current) trigger.current?.focus()
    wasOpen.current = open
  }, [open])

  return (
    <div className="min-w-0 max-w-full">
      <span id={`${id}-label`} className="mb-1.5 block text-xs font-medium text-gray-700">Date range</span>
      <button
        ref={trigger}
        type="button"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 transition-colors hover:border-brand-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:min-h-9"
      >
        <span id={`${id}-value`} className="min-w-0">{rangeLabel(value)}</span>
        <svg className="size-4 shrink-0 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 11h18" />
        </svg>
      </button>
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-danger-700">{error}</p>}
      {open && <DateRangeCalendar value={value} required={required} onClose={() => setOpen(false)} onChange={(range) => { onChange(range); setOpen(false) }} />}
    </div>
  )
}

function DateRangeCalendar({ value, onChange, onClose, required }: { value: DateRange; onChange: (range: DateRange) => void; onClose: () => void; required: boolean }) {
  const today = clinicDate(new Date().toISOString())
  const initial = validDate(value.from) ? value.from : validDate(value.to) ? value.to : today
  const [month, setMonth] = useState(initial.slice(0, 7))
  const [focused, setFocused] = useState(initial)
  const [start, setStart] = useState('')
  const [hovered, setHovered] = useState('')
  const focusedButton = useRef<HTMLButtonElement>(null)
  const moveFocus = useRef(true)
  const headingId = useId()
  const days = calendarDays(month)
  const preview = start ? orderedDateRange(start, hovered || start) : value
  const monthLabel = new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' })

  useEffect(() => {
    if (moveFocus.current) focusedButton.current?.focus()
    moveFocus.current = true
  }, [focused])

  function select(day: string) {
    if (!start) {
      // Commit only after the second click, so filters never fetch a half-picked range.
      setStart(day)
      setHovered(day)
      setFocused(day)
      setMonth(day.slice(0, 7))
    } else onChange(orderedDateRange(start, day))
  }

  function navigateMonth(amount: number) {
    const next = moveDate(focused, 0, amount)
    // Keep the month button focused so keyboard users can advance repeatedly.
    moveFocus.current = false
    setMonth(next.slice(0, 7))
    setFocused(next)
    setHovered('')
  }

  function navigateDay(event: KeyboardEvent<HTMLButtonElement>, day: string) {
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay()
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday }
    if (!(event.key in offsets) && event.key !== 'PageUp' && event.key !== 'PageDown') return
    event.preventDefault()
    const next = moveDate(day, offsets[event.key] ?? 0, event.key === 'PageUp' ? -1 : event.key === 'PageDown' ? 1 : 0)
    setFocused(next)
    setMonth(next.slice(0, 7))
    setHovered(next)
  }

  return (
    <Modal open onClose={onClose} title="Choose date range" size="sm" footer={<>
      {!required && (value.from || value.to) && <Button variant="ghost" onClick={() => onChange({ from: '', to: '' })}>Clear dates</Button>}
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
    </>}>
      <p aria-live="polite" className="mb-4 text-sm text-gray-600">
        {start ? `Start: ${formatDate(start)}. Choose the end date.` : 'Choose the start date, then the end date.'}
      </p>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button variant="ghost" aria-label="Previous month" onClick={() => navigateMonth(-1)}>‹</Button>
        <h3 id={headingId} aria-live="polite" className="text-sm font-semibold text-gray-900">{monthLabel}</h3>
        <Button variant="ghost" aria-label="Next month" onClick={() => navigateMonth(1)}>›</Button>
      </div>
      <div role="grid" aria-labelledby={headingId} className="w-full" onMouseLeave={() => setHovered('')}>
        <div role="row" className="grid grid-cols-7">
          {WEEKDAYS.map((day) => <span key={day} role="columnheader" className="py-2 text-center text-xs font-medium text-gray-500">{day}</span>)}
        </div>
        {Array.from({ length: days.length / 7 }, (_, week) => (
          <div key={week} role="row" className="grid grid-cols-7">
            {days.slice(week * 7, week * 7 + 7).map((day) => {
              const endpoint = day === preview.from || day === preview.to
              const inRange = !!preview.from && !!preview.to && day >= preview.from && day <= preview.to
              return <div key={day} role="gridcell" aria-selected={endpoint || inRange} className="py-0.5">
                <button
                  ref={day === focused ? focusedButton : undefined}
                  type="button"
                  tabIndex={day === focused ? 0 : -1}
                  aria-label={new Date(`${day}T00:00:00Z`).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                  aria-current={day === today ? 'date' : undefined}
                  onClick={() => select(day)}
                  onMouseEnter={() => setHovered(day)}
                  onFocus={() => { setFocused(day); if (start) setHovered(day) }}
                  onKeyDown={(event) => navigateDay(event, day)}
                  className={`flex min-h-11 w-full items-center justify-center text-sm transition-colors focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-700 ${endpoint ? 'rounded-md bg-brand-600 font-semibold text-white' : inRange ? 'bg-brand-50 text-brand-800' : day.startsWith(month) ? 'rounded-md text-gray-900 hover:bg-gray-100' : 'rounded-md text-gray-400 hover:bg-gray-100'} ${day === today && !endpoint ? 'font-semibold underline underline-offset-4' : ''}`}
                >{Number(day.slice(8))}</button>
              </div>
            })}
          </div>
        ))}
      </div>
    </Modal>
  )
}
