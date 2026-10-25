import { expect, it } from 'vitest'
import { generateBatchNumber, validBatchNumber } from './batchNumber'
it.each(['B-2091', '#LOT_123', 'AB/12.3', 'Lot 24', 'a'])('accepts batch number %s', (value) => expect(validBatchNumber(value)).toBe(true))
it.each(['', '---', 'A'.repeat(65), '<script>', 'LOT;DROP', 'LOT\n12'])('rejects invalid batch number %s', (value) => expect(validBatchNumber(value)).toBe(false))
it('generates distinct editable batch numbers in the allowed format', () => {
  const first = generateBatchNumber(); const second = generateBatchNumber()
  expect(validBatchNumber(first)).toBe(true)
  expect(first).not.toBe(second)
})
