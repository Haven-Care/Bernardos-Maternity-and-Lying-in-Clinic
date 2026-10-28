import { describe, expect, it } from 'vitest'
import { sampleCopy } from './sampleCopy.js'

describe('sample record presentation', () => {
  it('removes an internal seed prefix while preserving the note entered after it', () => {
    expect(sampleCopy('[havencare-demo-20261028-v2:client-01:completed-1] Follow-up requested after the next visit.'))
      .toBe('Follow-up requested after the next visit.')
  })
  it('keeps generated records clearly identified as samples without exposing seed keys', () => {
    expect(sampleCopy('[havencare-demo-20261028-v2:client-01:upcoming-booked] Synthetic demonstration reservation.')).toBe('Sample appointment.')
    expect(sampleCopy('Synthetic demonstration only. Seed: havencare-demo-20261028-v2')).toBe('Sample patient record.')
  })
  it.each([
    'Patient reports a seed allergy.',
    'Family history reviewed. Seed: other-system-record',
    '[external-reference:client-01] Follow-up in two weeks.',
    'No known allergies',
    '',
  ])('preserves ordinary record text: %s', (note) => {
    expect(sampleCopy(note)).toBe(note)
  })
})
