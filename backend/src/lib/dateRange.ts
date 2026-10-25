import { z } from 'zod'

export const datedListQuery = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(500).default(500),
}).refine((value) => !value.from || !value.to || value.from <= value.to, 'Start date must be on or before end date.')

export function afterClinicDay(day: string): string {
  const next = new Date(`${day}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return `${next.toISOString().slice(0, 10)}T00:00:00+08:00`
}
