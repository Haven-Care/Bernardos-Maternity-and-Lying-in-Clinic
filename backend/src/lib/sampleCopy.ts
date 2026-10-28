const sampleLabels = new Map([
  ['Synthetic demonstration reservation.', 'Sample appointment.'],
  ['Synthetic demonstration record; no real clinical findings.', 'Sample clinical record for demonstration.'],
  ['Synthetic demo address, Caloocan City', 'Caloocan City (sample)'],
  ['Demo record', 'Not recorded (sample)'],
  ['Demo Clinician', 'Sample clinician'],
  ['Synthetic demo record', 'Not recorded (sample)'],
  ['Synthetic opening receipt', 'Opening stock receipt (sample)'],
  ['Synthetic completed dispensing', 'Stock issued (sample)'],
  ['Synthetic partial disposal history; no real stock transaction', 'Partial stock disposal (sample)'],
])

/** Format known sample notes for display while preserving stored records. */
export function sampleCopy(value: string): string {
  // Match this application's seed identifiers only; ordinary clinical notes
  // and any text entered after a seed marker must retain their contents.
  const note = value.replace(/^\[havencare-demo-\d{8}-v\d+:client-\d{2}:[a-z0-9-]+\]\s*/, '')
  if (/^Synthetic demonstration only\. Seed: havencare-demo-\d{8}-v\d+$/.test(note)) return 'Sample patient record.'
  if (/^Demo consultation \d+$/.test(note)) return note.replace('Demo consultation', 'Sample consultation')
  return sampleLabels.get(note) ?? note
}
