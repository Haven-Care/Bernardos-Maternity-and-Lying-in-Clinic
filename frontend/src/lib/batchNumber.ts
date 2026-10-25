export const BATCH_NUMBER_HINT = 'Use up to 64 letters, numbers, spaces, -, #, _, /, or .; include at least one letter or number.'
export function validBatchNumber(value: string): boolean {
  return /^[A-Za-z0-9#_./ -]{1,64}$/.test(value.trim()) && /[A-Za-z0-9]/.test(value)
}
export function generateBatchNumber(): string {
  return `B-${crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`
}
