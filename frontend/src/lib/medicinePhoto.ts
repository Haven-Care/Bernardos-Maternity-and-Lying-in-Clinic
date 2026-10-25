export function medicinePhotoError(file: Pick<File, 'type' | 'size'>): string | undefined {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size <= 0 || file.size > 5 * 1024 * 1024) {
    return 'Choose a JPG, PNG, or WebP image up to 5 MB.'
  }
}
