/**
 * Namespaced so call sites read as `appointments.listBookings()` rather than a
 * flat soup of twenty verbs — and so `grep` on a domain name finds its uses.
 */
export * as account from './account'
export * as appointments from './appointments'
export * as clinic from './clinic'
export * as dashboard from './dashboard'
export * as inventory from './inventory'
export * as patients from './patients'
export * as services from './services'
export * as slots from './slots'
