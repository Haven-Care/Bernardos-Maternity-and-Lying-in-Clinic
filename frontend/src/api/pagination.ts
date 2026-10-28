import { apiFetch } from './client'

/** Fetch every page so date filters do not silently search only the latest rows. */
export async function datedList<T extends { id: string }>(path: string, dates?: { from: string; to: string }): Promise<T[]> {
  const rows: T[] = []
  const limit = 500
  for (;;) {
    const query = new URLSearchParams({ offset: String(rows.length), limit: String(limit) })
    if (dates?.from) query.set('from', dates.from)
    if (dates?.to) query.set('to', dates.to)
    const page = await apiFetch<T[]>(`${path}${path.includes('?') ? '&' : '?'}${query}`)
    if (rows.length && page[0]?.id === rows[0].id) throw new Error('We couldn’t load the full history. Please try again later.')
    rows.push(...page)
    if (page.length < limit) return rows
  }
}
