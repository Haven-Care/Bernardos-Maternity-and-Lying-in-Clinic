import { beforeEach, describe, expect, it, vi } from 'vitest'
import { list as listAccounts } from './patientAccounts'
import { list as listHistory } from './clinicalHistory'
import { apiFetch } from './client'

vi.mock('./client', () => ({ apiFetch: vi.fn() }))

const fetchMock = vi.mocked(apiFetch)

beforeEach(() => fetchMock.mockReset())

describe('paginated lists', () => {
  it('loads accounts beyond the first page', async () => {
    fetchMock
      .mockResolvedValueOnce(Array.from({ length: 100 }, (_, i) => ({ id: `account-${i}` })))
      .mockResolvedValueOnce([{ id: 'account-100' }])

    expect(await listAccounts()).toHaveLength(101)
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/patient-accounts?offset=100&limit=100')
  })

  it('loads older clinical records beyond the first page', async () => {
    fetchMock
      .mockResolvedValueOnce(Array.from({ length: 200 }, (_, i) => ({ id: `record-${i}` })))
      .mockResolvedValueOnce([{ id: 'record-200' }])

    expect(await listHistory('patient-id')).toHaveLength(201)
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/patients/patient-id/clinical-history?offset=200&limit=200')
  })

  it('stops if an older backend ignores the page parameters', async () => {
    const page = Array.from({ length: 100 }, (_, i) => ({ id: `account-${i}` }))
    fetchMock.mockResolvedValue(page)

    expect(await listAccounts()).toHaveLength(100)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
