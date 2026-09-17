/**
 * Display formatting. Locale is pinned to en-PH — this is a Philippine clinic
 * and dates must not reformat based on whose machine the browser is on.
 */

const LOCALE = 'en-PH'

/** `Aug 25, 2026` */
export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** `Tuesday, August 25` */
export function formatDateLong(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(LOCALE, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

/** `08:00` → `8:00 AM` */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`
}

/** `Aug 25, 2026, 8:00 AM` — the "Preferred Date & Time" line. */
export function formatDateTime(iso: string, time: string): string {
  return `${formatDate(iso)}, ${formatTime(time)}`
}

/** A full timestamp, e.g. `Aug 22, 2026 2:20 PM`. */
export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** `₱300` — whole pesos, as the prototype shows them. */
export function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString(LOCALE, {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

/** `2 days` / `1 day` / `Expired` — the Days Left column. */
export function formatDaysLeft(days: number): string {
  if (days < 0) return 'Expired'
  if (days === 0) return 'Today'
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
