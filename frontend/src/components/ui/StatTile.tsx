import type { ReactNode } from 'react'

/**
 * A labelled count. The Dashboard and every Inventory tab open with a row of
 * these.
 *
 * Per the dataviz guidance a bare number is the right form for a single
 * magnitude — no sparkline, no chart furniture. The number carries the weight,
 * so it is large and the label is small and muted, not the other way round.
 */
export function StatTile({
  label,
  value,
  tone = 'default',
  icon,
}: {
  label: string
  value: number | string
  tone?: 'default' | 'warning' | 'danger'
  icon?: ReactNode
}) {
  const valueTone =
    tone === 'danger'
      ? 'text-danger-700'
      : tone === 'warning'
        ? 'text-warning-700'
        : 'text-gray-900'

  return (
    <div className="flex min-w-0 flex-col justify-between rounded-card border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm leading-snug font-medium text-gray-500">{label}</p>
        {icon}
      </div>
      <p
        className={`mt-4 text-right text-3xl leading-none font-semibold tabular-nums ${valueTone}`}
      >
        {value}
      </p>
    </div>
  )
}

export function StatTileSkeleton() {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
      <div className="mt-4 ml-auto h-8 w-10 animate-pulse rounded bg-gray-100" />
    </div>
  )
}
