import { useMemo, useState, type ReactNode } from 'react'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  /** Extra classes on the cell — width hints, truncation, etc. */
  className?: string
}

const ALIGN = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
} as const

/**
 * The table every module uses, with the prototype's
 * "Showing 1 to 5 of 20 entries" footer and pager.
 *
 * Pagination is client-side because the fixtures are in memory. When the
 * backend lands it takes `page`/`pageSize` params and returns a total — pass
 * `serverSide` and hoist the state, and the markup here doesn't change.
 */
export function Table<T>({
  columns,
  rows,
  rowKey,
  pageSize = 10,
  onRowClick,
  empty,
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  pageSize?: number
  onRowClick?: (row: T) => void
  empty?: ReactNode
}) {
  const [page, setPage] = useState(0)

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  // Clamp rather than reset: deleting the last row of page 3 should land on
  // page 2, not throw the user back to the start.
  const current = Math.min(page, pageCount - 1)

  const visible = useMemo(
    () => rows.slice(current * pageSize, current * pageSize + pageSize),
    [rows, current, pageSize],
  )

  if (rows.length === 0 && empty) return <>{empty}</>

  const first = rows.length === 0 ? 0 : current * pageSize + 1
  const last = Math.min(rows.length, (current + 1) * pageSize)

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap text-gray-500 ${ALIGN[col.align ?? 'left']} ${col.className ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={
                  onRowClick
                    ? 'cursor-pointer transition-colors hover:bg-gray-50'
                    : undefined
                }
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-gray-700 ${ALIGN[col.align ?? 'left']} ${col.className ?? ''}`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5">
        <p className="text-xs text-gray-500">
          Showing {first} to {last} of {rows.length}{' '}
          {rows.length === 1 ? 'entry' : 'entries'}
        </p>

        {pageCount > 1 && (
          <div className="flex items-center gap-1">
            <PagerButton
              onClick={() => setPage(current - 1)}
              disabled={current === 0}
              label="Previous page"
            >
              <Chevron className="rotate-180" />
            </PagerButton>
            <span className="px-2 text-xs tabular-nums text-gray-500">
              {current + 1} / {pageCount}
            </span>
            <PagerButton
              onClick={() => setPage(current + 1)}
              disabled={current >= pageCount - 1}
              label="Next page"
            >
              <Chevron />
            </PagerButton>
          </div>
        )}
      </div>
    </div>
  )
}

function PagerButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void
  disabled: boolean
  label: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-6 items-center justify-center rounded border border-gray-300 text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}

function Chevron({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`size-3.5 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}
