// ---------------------------------------------------------------------------
// GENERATED — do not edit.
//
// Source: frontend/src/types/. Regenerate with `npm run sync:types`.
// Edit the frontend copy; it is the contract, and this is a mirror of it.
// ---------------------------------------------------------------------------

import type { Peso } from './common.js'

/**
 * A bookable service. Administration → Services & Pricing.
 *
 * Category is free text in the design — the Add Service modal's field is a plain
 * input with placeholder "e.g. Consultation", not a select. Observed values are
 * `Consultation` and `Diagnostic`.
 */
export interface Service {
  id: string
  name: string
  category: string
  price: Peso
  active: boolean
}

export interface ServiceInput {
  name: string
  category: string
  price: Peso
}
