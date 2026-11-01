import { describe, expect, it } from 'vitest'
import { sniffDocumentType } from './fileSignature.js'

const bytes = (...parts: (string | number[])[]) =>
  new Uint8Array(parts.flatMap((part) => (typeof part === 'string' ? [...part].map((c) => c.charCodeAt(0)) : part)))

describe('sniffDocumentType', () => {
  it('recognises each accepted document type by its signature', () => {
    expect(sniffDocumentType(bytes('%PDF-1.7\n'))).toBe('application/pdf')
    expect(sniffDocumentType(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(sniffDocumentType(bytes([0x89], 'PNG\r\n', [0x1a], '\n'))).toBe('image/png')
    expect(sniffDocumentType(bytes('RIFF', [0, 0, 0, 0], 'WEBPVP8 '))).toBe('image/webp')
    expect(sniffDocumentType(bytes([0, 0, 0, 0x18], 'ftypheic'))).toBe('image/heic')
  })

  it('rejects anything else, whatever it was named', () => {
    expect(sniffDocumentType(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull()
    expect(sniffDocumentType(bytes('<!doctype html>'))).toBeNull()
    expect(sniffDocumentType(bytes('MZ', [0x90, 0]))).toBeNull()
    expect(sniffDocumentType(bytes([0, 0, 0, 0x18], 'ftypmp42'))).toBeNull()
    expect(sniffDocumentType(new Uint8Array())).toBeNull()
  })
})
