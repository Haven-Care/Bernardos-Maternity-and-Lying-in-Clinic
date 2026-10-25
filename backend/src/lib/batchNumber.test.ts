import { expect, it } from 'vitest'
import { batchNumberSchema } from './batchNumber.js'
it.each([undefined, '', '  '])('generates a batch number when omitted (%s)', (value) => {
  expect(batchNumberSchema.parse(value)).toMatch(/^B-[A-F0-9]{16}$/)
})
it.each(['B-123', '#LOT_123', 'AB/12.3', 'Lot 24'])('preserves a valid custom batch %s', (value) => expect(batchNumberSchema.parse(value)).toBe(value))
it.each(['---', '<script>', 'LOT;DROP', 'A'.repeat(65), 'LOT\n12'])('rejects batch number %s', (value) => expect(batchNumberSchema.safeParse(value).success).toBe(false))
