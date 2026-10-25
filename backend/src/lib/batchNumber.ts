import { z } from 'zod'

export const batchNumberSchema = z.string().trim().max(64)
  .refine((value) => value === '' || (/^[A-Za-z0-9#_./ -]+$/.test(value) && /[A-Za-z0-9]/.test(value)),
    'Use letters, numbers, spaces, -, #, _, /, or .; include at least one letter or number.')
  .optional().transform((value) => value || `B-${crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`)
