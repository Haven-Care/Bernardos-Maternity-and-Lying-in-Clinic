/**
 * What a patient document actually is, from its first bytes.
 *
 * The browser declares a Content-Type when it uploads to the signed URL, and
 * Storage checks only that declaration against the bucket's allow-list. A
 * script renamed to `scan.pdf` and labelled application/pdf passes both. The
 * signature is what the file is, whatever it was called.
 */

export type DocumentType = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic'

const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'])

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end))
}

/** Needs the first 12 bytes; returns null for anything not accepted. */
export function sniffDocumentType(head: Uint8Array): DocumentType | null {
  if (ascii(head, 0, 5) === '%PDF-') return 'application/pdf'
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg'
  if (ascii(head, 0, 8) === '\x89PNG\r\n\x1a\n') return 'image/png'
  if (ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 12) === 'WEBP') return 'image/webp'
  if (ascii(head, 4, 8) === 'ftyp' && HEIC_BRANDS.has(ascii(head, 8, 12))) return 'image/heic'
  return null
}
