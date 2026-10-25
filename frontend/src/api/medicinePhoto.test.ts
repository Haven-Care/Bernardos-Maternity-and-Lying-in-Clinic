import { beforeEach, describe, expect, it, vi } from 'vitest'
const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock('./client', () => ({ apiFetch }))
import { uploadMedicinePhoto } from './inventory'
import { medicinePhotoError } from '../lib/medicinePhoto'
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal('fetch', vi.fn()) })
describe('medicine photo uploads', () => {
  it('rejects unsupported, empty, and oversized files before requesting an upload', async () => {
    for (const file of [{ type: 'image/svg+xml', size: 1 }, { type: 'image/png', size: 0 }, { type: 'image/jpeg', size: 5242881 }]) {
      expect(medicinePhotoError(file)).toBeDefined()
      await expect(uploadMedicinePhoto('medicine', file as File)).rejects.toThrow('up to 5 MB')
    }
    expect(apiFetch).not.toHaveBeenCalled()
  })
  it('does not commit a failed upload', async () => {
    apiFetch.mockResolvedValue({ path: 'medicine/photo.png', signedUrl: 'https://storage.example/upload' })
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response)
    await expect(uploadMedicinePhoto('medicine', { type: 'image/png', size: 1 } as File)).rejects.toThrow('could not be uploaded')
    expect(apiFetch).toHaveBeenCalledTimes(1)
  })
  it('attaches the object only after storage accepts it', async () => {
    apiFetch.mockResolvedValueOnce({ path: 'medicine/photo.png', signedUrl: 'https://storage.example/upload' }).mockResolvedValueOnce({ saved: true })
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)
    await uploadMedicinePhoto('medicine', { type: 'image/png', size: 1 } as File)
    expect(apiFetch).toHaveBeenLastCalledWith('/inventory/medicines/medicine/photo', { method: 'PUT', body: JSON.stringify({ storagePath: 'medicine/photo.png' }) })
    expect(vi.mocked(fetch).mock.invocationCallOrder[0]).toBeLessThan(apiFetch.mock.invocationCallOrder[1])
  })
})
