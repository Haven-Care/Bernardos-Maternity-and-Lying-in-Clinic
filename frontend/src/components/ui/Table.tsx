import { Fragment, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'

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
  fillHeight = false,
  fitRows = false,
  onRowClick,
  expandable,
  empty,
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  pageSize?: number
  fillHeight?: boolean
  fitRows?: boolean
  onRowClick?: (row: T) => void
  expandable?: { label: (row: T) => string; render: (row: T) => ReactNode }
  empty?: ReactNode
}) {
  const [page, setPage] = useState(0)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const expansionId = useId()
  const [detailWidth, setDetailWidth] = useState<number>()
  const hasExpandableRows = expandable !== undefined
  const viewport = useRef<HTMLDivElement>(null)
  const [capacity, setCapacity] = useState(pageSize)
  useLayoutEffect(() => {
    const element = viewport.current
    if (!element || (!fitRows && !hasExpandableRows)) return
    const measure = () => {
      // clientWidth excludes the scrollbar, keeping expanded details readable
      // even when the summary columns need horizontal scrolling on a phone.
      if (hasExpandableRows) setDetailWidth(element.clientWidth)
      if (!fitRows) return
      const headerHeight = element.querySelector('thead')?.getBoundingClientRect().height ?? 40
      // Compact inventory rows are 56px; clientHeight excludes horizontal scrollbar.
      setCapacity(Math.max(1, Math.floor((element.clientHeight - headerHeight - 2) / 56)))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [fitRows, hasExpandableRows, rows.length])
  const effectivePageSize = fitRows ? Math.min(pageSize, capacity) : pageSize

  const pageCount = Math.max(1, Math.ceil(rows.length / effectivePageSize))
  // Clamp rather than reset: deleting the last row of page 3 should land on
  // page 2, not throw the user back to the start.
  const current = Math.min(page, pageCount - 1)

  const visible = useMemo(
    () => rows.slice(current * effectivePageSize, current * effectivePageSize + effectivePageSize),
    [rows, current, effectivePageSize],
  )

  if (rows.length === 0 && empty) return <>{empty}</>

  const first = rows.length === 0 ? 0 : current * effectivePageSize + 1
  const last = Math.min(rows.length, (current + 1) * effectivePageSize)

  return (
    <div className={`flex min-w-0 flex-col ${fillHeight ? 'min-h-0 flex-1' : ''}`}>
      <div ref={viewport} role="region" aria-label="Data table" tabIndex={0} className={fitRows ? 'min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden' : fillHeight ? 'min-h-0 min-w-0 flex-1 overflow-auto' : 'min-w-0 overflow-x-auto'}>
        <table className={`w-full min-w-[640px] border-collapse text-sm ${fitRows ? 'inventory-fit-table' : ''}`}>
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
            {visible.map((row) => {
              const key = rowKey(row)
              const expanded = !!expandable && expandedKey === key
              const detailsId = `${expansionId}-${encodeURIComponent(key)}`
              const toggle = () => setExpandedKey((current) => current === key ? null : key)
              return (
                <Fragment key={key}>
                  <tr
                    onClick={expandable ? (event) => {
                      // Links and controls inside a cell keep their own action.
                      if ((event.target as Element).closest('a, button, input, select, textarea, [role="button"], [role="switch"]')) return
                      toggle()
                    } : onRowClick ? () => onRowClick(row) : undefined}
                    className={
                      expandable || onRowClick
                        ? `cursor-pointer transition-colors hover:bg-gray-50 ${expanded ? 'bg-brand-50/60' : ''}`
                        : undefined
                    }
                  >
                    {columns.map((col, index) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 text-gray-700 ${ALIGN[col.align ?? 'left']} ${col.className ?? ''}`}
                      >
                        {expandable && index === 0 ? (
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={toggle} aria-expanded={expanded} aria-controls={detailsId}
                              aria-label={`${expanded ? 'Collapse' : 'Expand'} ${expandable.label(row)}`}
                              className="flex size-10 shrink-0 items-center justify-center rounded-md text-brand-700 hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-brand-600">
                              <Chevron className={expanded ? 'rotate-90' : ''} />
                            </button>
                            {col.render(row)}
                          </div>
                        ) : col.render(row)}
                      </td>
                    ))}
                  </tr>
                  {expanded && expandable && (
                    <tr id={detailsId}>
                      <td colSpan={columns.length} className="bg-brand-50/30 p-0">
                        {/* Keep details within the viewport while the summary table scrolls horizontally. */}
                        <div className="sticky left-0 max-w-full p-4 sm:p-5" style={{ width: detailWidth }}>{expandable.render(row)}</div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5">
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
      className="flex size-10 items-center justify-center rounded border border-gray-300 text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 sm:size-8"
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
