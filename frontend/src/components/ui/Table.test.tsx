import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Table } from './Table'

describe('expandable tables', () => {
  it('keeps patient detail components unmounted until a row is expanded', () => {
    const renderDetails = vi.fn(() => <p>Private patient details</p>)
    const markup = renderToStaticMarkup(<Table
      columns={[{ key: 'reference', header: 'Reference', render: (row: { id: string }) => row.id }]}
      rows={[{ id: 'BR-1000' }]} rowKey={(row) => row.id}
      expandable={{ label: (row) => `appointment ${row.id}`, render: renderDetails }}
    />)
    expect(renderDetails).not.toHaveBeenCalled()
    expect(markup).not.toContain('Private patient details')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).toContain('aria-label="Expand appointment BR-1000"')
  })

  it('keeps ordinary tables free of expansion controls', () => {
    const markup = renderToStaticMarkup(<Table
      columns={[{ key: 'name', header: 'Name', render: (row: { id: string }) => row.id }]}
      rows={[{ id: 'Medicine' }]} rowKey={(row) => row.id}
    />)
    expect(markup).toContain('Medicine')
    expect(markup).not.toContain('aria-expanded')
  })
})
