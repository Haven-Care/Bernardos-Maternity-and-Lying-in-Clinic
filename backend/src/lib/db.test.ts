import { describe, expect, it, vi } from 'vitest'
import { READ_ALL_PAGE, readAll } from './db.js'

const rows = (from: number, count: number) => Array.from({ length: count }, (_, i) => ({ id: from + i }))

describe('readAll', () => {
  it('keeps reading past the row cap until a page comes back short', async () => {
    const page = vi.fn()
      .mockResolvedValueOnce({ data: rows(0, READ_ALL_PAGE), error: null })
      .mockResolvedValueOnce({ data: rows(READ_ALL_PAGE, READ_ALL_PAGE), error: null })
      .mockResolvedValueOnce({ data: rows(READ_ALL_PAGE * 2, 3), error: null })

    const result = await readAll(page)

    expect(result).toHaveLength(READ_ALL_PAGE * 2 + 3)
    expect(page.mock.calls).toEqual([
      [0, READ_ALL_PAGE - 1],
      [READ_ALL_PAGE, READ_ALL_PAGE * 2 - 1],
      [READ_ALL_PAGE * 2, READ_ALL_PAGE * 3 - 1],
    ])
  })

  it('stops after one request when everything fits', async () => {
    const page = vi.fn().mockResolvedValue({ data: [], error: null })
    expect(await readAll(page)).toEqual([])
    expect(page).toHaveBeenCalledTimes(1)
  })

  it('fails the whole read rather than returning the pages before an error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const page = vi.fn()
      .mockResolvedValueOnce({ data: rows(0, READ_ALL_PAGE), error: null })
      .mockResolvedValueOnce({ data: null, error: { code: 'XX000', message: 'boom', details: '', hint: '' } })

    await expect(readAll(page)).rejects.toMatchObject({ status: 500 })
  })
})
