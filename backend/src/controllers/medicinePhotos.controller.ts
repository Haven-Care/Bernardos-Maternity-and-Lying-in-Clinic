import type { Request, Response } from 'express'
import { z } from 'zod'
import { getSupabaseClient } from '../config/supabase.js'
import { dbError, unwrap } from '../lib/db.js'
import { parseBody } from '../lib/validate.js'
import { HttpError } from '../middleware/errorHandler.js'

const idSchema = z.string().uuid()
const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const
const uploadSchema = z.object({ contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']) })
const photoSchema = z.object({ storagePath: z.string().min(1) })
const bucketName = 'medicine-photos'

async function medicineId(req: Request) {
  const id = parseBody(idSchema, req.params.id)
  unwrap(await getSupabaseClient().from('medicines').select('id').eq('id', id).maybeSingle(), 'No such medicine.')
  return id
}

export async function getMedicinePhoto(req: Request, res: Response) {
  const id = await medicineId(req)
  const { data: photo, error } = await getSupabaseClient().from('medicine_photos')
    .select('storage_path').eq('medicine_id', id).maybeSingle()
  if (error) throw dbError(error)
  if (!photo) { res.json({ url: null }); return }
  const { data, error: signingError } = await getSupabaseClient().storage.from(bucketName)
    .createSignedUrl(photo.storage_path, 300)
  if (signingError) throw new HttpError(502, 'Could not load the medicine photo.')
  res.json({ url: data.signedUrl })
}

export async function createMedicinePhotoUpload(req: Request, res: Response) {
  const { contentType } = parseBody(uploadSchema, req.body)
  const id = await medicineId(req)
  const path = `${id}/${crypto.randomUUID()}.${extensions[contentType]}`
  const { data, error } = await getSupabaseClient().storage.from(bucketName).createSignedUploadUrl(path)
  if (error) throw new HttpError(502, 'Could not start the photo upload.')
  res.json({ path: data.path, signedUrl: data.signedUrl })
}

export async function saveMedicinePhoto(req: Request, res: Response) {
  const { storagePath } = parseBody(photoSchema, req.body)
  const id = await medicineId(req)
  // Only attach immutable, server-issued paths belonging to this medicine.
  const fileName = storagePath.slice(id.length + 1)
  if (!storagePath.startsWith(`${id}/`) || !/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(fileName)) {
    throw new HttpError(400, 'Invalid medicine photo path.')
  }
  const db = getSupabaseClient()
  const bucket = db.storage.from(bucketName)
  const { data: object, error: objectError } = await bucket.info(storagePath)
  if (objectError || !object) throw new HttpError(400, 'Upload the photo before saving it.')
  if (!Object.hasOwn(extensions, object.contentType ?? '') || !object.size || object.size > 5242880) {
    throw new HttpError(400, 'Choose a JPG, PNG, or WebP image up to 5 MB.')
  }
  const { data: previous, error: readError } = await db.from('medicine_photos')
    .select('storage_path').eq('medicine_id', id).maybeSingle()
  if (readError) throw dbError(readError)
  const { error } = await db.from('medicine_photos').upsert({
    medicine_id: id, storage_path: storagePath, updated_at: new Date().toISOString(),
  })
  if (error) throw dbError(error)
  // A cleanup failure must not report the already-saved replacement as failed.
  if (previous && previous.storage_path !== storagePath) await bucket.remove([previous.storage_path]).catch(() => undefined)
  res.json({ saved: true })
}
