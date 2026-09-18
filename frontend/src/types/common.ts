/**
 * Shared primitives.
 *
 * Every type in this directory is read off the Figma prototype:
 * https://www.figma.com/design/HN1MtjiHtwzJKvBLXCjWqC/HavenCare-Prototype
 *
 * These types are the contract. The backend phase implements them — it does not
 * redesign them. Where a field was inferred rather than observed in the design,
 * it is marked `INFERRED`.
 */

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export const WEEKDAYS: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

/** ISO 8601 date, `YYYY-MM-DD`. */
export type DateString = string

/** ISO 8601 timestamp. */
export type DateTimeString = string

/** 24-hour wall clock, `HH:mm`. Slots are clock times, not instants. */
export type TimeString = string

/** Philippine peso. Prices in the prototype are whole pesos (₱300, ₱500). */
export type Peso = number
