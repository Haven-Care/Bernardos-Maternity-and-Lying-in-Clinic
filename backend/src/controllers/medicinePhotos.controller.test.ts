import type { Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
const { getClient } = vi.hoisted(() => ({ getClient: vi.fn() }))
vi.mock('../config/supabase.js', () => ({ getSupabaseClient: getClient }))
import { createMedicinePhotoUpload, getMedicinePhoto, saveMedicinePhoto } from './medicinePhotos.controller.js'

const id = 'a6e591be-05e4-4da9-8a7a-5a0af373b57a'
const path = `${id}/f04f7c0e-33a3-497e-83e3-f6090b4845a9.png`
const imageBytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#008080' } }).png().toBuffer()
function setup(body: object = {}) {
  const medicine = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { id }, error: null }) }
  medicine.select.mockReturnValue(medicine); medicine.eq.mockReturnValue(medicine)
  const photo = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), upsert: vi.fn().mockResolvedValue({ error: null }) }
  photo.select.mockReturnValue(photo); photo.eq.mockReturnValue(photo)
  const bucket = {
    info: vi.fn().mockResolvedValue({ data: { contentType: 'image/png', size: 1024 }, error: null }),
    download: vi.fn().mockResolvedValue({ data: new Blob([new Uint8Array(imageBytes)]), error: null }),
    createSignedUploadUrl: vi.fn().mockResolvedValue({ data: { path, signedUrl: 'https://storage.example/upload' }, error: null }),
    createSignedUrl: vi.fn(), remove: vi.fn().mockResolvedValue({ error: null }),
  }
  getClient.mockReturnValue({ from: (table: string) => table === 'medicines' ? medicine : photo, storage: { from: () => bucket } })
  const json = vi.fn()
  return { medicine, photo, bucket, json, req: { params: { id }, body } as unknown as Request, res: { json } as unknown as Response }
}
beforeEach(() => getClient.mockReset())
describe('staff medicine photo storage', () => {
  it('returns no photo without minting a URL for an empty record', async () => {
    const s = setup(); await getMedicinePhoto(s.req, s.res)
    expect(s.json).toHaveBeenCalledWith({ url: null })
    expect(s.bucket.createSignedUrl).not.toHaveBeenCalled()
  })
  it('rejects SVG uploads before creating a storage object', async () => {
    const s = setup({ contentType: 'image/svg+xml' })
    await expect(createMedicinePhotoUpload(s.req, s.res)).rejects.toThrow()
    expect(s.bucket.createSignedUploadUrl).not.toHaveBeenCalled()
  })
  it('does not attach another medicine’s image or a traversal path', async () => {
    for (const storagePath of [`other/${path}`, `${id}/../${path}`]) {
      const s = setup({ storagePath })
      await expect(saveMedicinePhoto(s.req, s.res)).rejects.toThrow('Invalid medicine photo path')
      expect(s.photo.upsert).not.toHaveBeenCalled()
    }
  })
  it('requires an uploaded object before committing the photo', async () => {
    const s = setup({ storagePath: path }); s.bucket.info.mockResolvedValue({ data: null, error: { message: 'missing' } })
    await expect(saveMedicinePhoto(s.req, s.res)).rejects.toThrow('Upload the photo')
    expect(s.photo.upsert).not.toHaveBeenCalled()
  })
  it('checks stored MIME type and size rather than trusting the save request', async () => {
    for (const metadata of [{ contentType: 'image/svg+xml', size: 1024 }, { contentType: 'image/png', size: 5242881 }]) {
      const s = setup({ storagePath: path }); s.bucket.info.mockResolvedValue({ data: metadata, error: null })
      await expect(saveMedicinePhoto(s.req, s.res)).rejects.toThrow('up to 5 MB')
      expect(s.photo.upsert).not.toHaveBeenCalled()
    }
  })
  it('preserves the old photo when recording the replacement fails', async () => {
    const s = setup({ storagePath: path })
    s.photo.maybeSingle.mockResolvedValue({ data: { storage_path: 'previous.png' }, error: null })
    s.photo.upsert.mockResolvedValue({ error: { message: 'write failed', code: 'XX000' } })
    await expect(saveMedicinePhoto(s.req, s.res)).rejects.toThrow()
    expect(s.bucket.remove).not.toHaveBeenCalled()
  })
  it('rejects non-image bytes even when storage labels them as PNG', async () => {
    const s = setup({ storagePath: path })
    s.bucket.download.mockResolvedValue({ data: new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>']), error: null })
    await expect(saveMedicinePhoto(s.req, s.res)).rejects.toThrow('Choose a valid')
    expect(s.photo.upsert).not.toHaveBeenCalled()
    expect(s.bucket.remove).not.toHaveBeenCalled()
  })
  it('rejects truncated PNG content with a valid image header', async () => {
    const s = setup({ storagePath: path })
    s.bucket.download.mockResolvedValue({ data: new Blob([new Uint8Array(imageBytes.subarray(0, 40))]), error: null })
    await expect(saveMedicinePhoto(s.req, s.res)).rejects.toThrow('Choose a valid')
    expect(s.photo.upsert).not.toHaveBeenCalled()
  })
  it('rejects decoded images whose format differs from the upload ticket', async () => {
    const s = setup({ storagePath: path })
    const jpeg = await sharp(imageBytes).jpeg().toBuffer()
    s.bucket.download.mockResolvedValue({ data: new Blob([new Uint8Array(jpeg)]), error: null })
    await expect(saveMedicinePhoto(s.req, s.res)).rejects.toThrow('Choose a valid')
    expect(s.photo.upsert).not.toHaveBeenCalled()
  })
  it('preserves the previous photo when the uploaded bytes cannot be downloaded', async () => {
    const s = setup({ storagePath: path })
    s.bucket.download.mockResolvedValue({ data: null, error: { message: 'unavailable' } })
    await expect(saveMedicinePhoto(s.req, s.res)).rejects.toThrow('Could not validate')
    expect(s.photo.upsert).not.toHaveBeenCalled()
    expect(s.bucket.remove).not.toHaveBeenCalled()
  })
  it('replaces the photo before removing the previous object', async () => {
    const s = setup({ storagePath: path })
    s.photo.maybeSingle.mockResolvedValue({ data: { storage_path: 'previous.png' }, error: null })
    await saveMedicinePhoto(s.req, s.res)
    expect(s.photo.upsert).toHaveBeenCalledWith(expect.objectContaining({ medicine_id: id, storage_path: path }))
    expect(s.bucket.remove).toHaveBeenCalledWith(['previous.png'])
    expect(s.photo.upsert.mock.invocationCallOrder[0]).toBeLessThan(s.bucket.remove.mock.invocationCallOrder[0])
    expect(s.json).toHaveBeenCalledWith({ saved: true })
  })
})
