import { z } from 'zod'
import { pageQuery } from './validate.js'

export const datedListQuery = pageQuery.extend({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
}).refine((value) => !value.from || !value.to || value.from <= value.to, 'Start date must be on or before end date.')

export function afterClinicDay(day: string): string {
  const next = new Date(`${day}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return `${next.toISOString().slice(0, 10)}T00:00:00+08:00`
}
