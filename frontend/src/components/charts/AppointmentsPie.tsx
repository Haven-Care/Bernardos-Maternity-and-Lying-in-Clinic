import { useState } from 'react'
import type { AppointmentStatus } from '../../types/appointment'
import type { AppointmentsOverviewSlice } from '../../types/dashboard'

/**
 * Appointments Overview donut.
 *
 * Hand-rolled SVG rather than a charting dependency — it is one part-to-whole
 * figure with five slices, and Recharts would add ~90 kB gzipped for it.
 *
 * Palette: validated with the dataviz validator against both the light and dark
 * surfaces. All six checks pass in both modes; worst adjacent pair is
 * confirmed↔completed at ΔE 19.3 deutan / 11.1 tritan. **Do not substitute
 * colours by eye** — re-run the validator if these change.
 *
 * Colour is never the only encoding: every slice is also named in the legend
 * with its count and percentage, so the figure survives greyscale and CVD.
 */
const SLICE_COLORS: Record<AppointmentStatus, string> = {
  completed: '#00A39B',
  confirmed: '#4667D9',
  pending: '#C77700',
  rescheduled: '#9061F9',
  cancelled: '#E5484D',
}

const LABELS: Record<AppointmentStatus, string> = {
  completed: 'Completed',
  confirmed: 'Confirmed',
  pending: 'Pending',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
}

const SIZE = 200
const RADIUS = 88
const THICKNESS = 34
/** Gap between slices, in degrees — the 2px surface spacer from the mark specs. */
const GAP_DEG = 1.4

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(startDeg: number, endDeg: number) {
  const cx = SIZE / 2
  const cy = SIZE / 2
  const outer = RADIUS
  const inner = RADIUS - THICKNESS

  const largeArc = endDeg - startDeg > 180 ? 1 : 0
  const o1 = polar(cx, cy, outer, startDeg)
  const o2 = polar(cx, cy, outer, endDeg)
  const i1 = polar(cx, cy, inner, endDeg)
  const i2 = polar(cx, cy, inner, startDeg)

  return [
    `M ${o1.x} ${o1.y}`,
    `A ${outer} ${outer} 0 ${largeArc} 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${inner} ${inner} 0 ${largeArc} 0 ${i2.x} ${i2.y}`,
    'Z',
  ].join(' ')
}

export function AppointmentsPie({
  slices,
}: {
  slices: AppointmentsOverviewSlice[]
}) {
  const [hovered, setHovered] = useState<AppointmentStatus | null>(null)

  const total = slices.reduce((sum, s) => sum + s.count, 0)
  if (total === 0) {
    return (
      <p className="py-12 text-center text-sm text-gray-400">
        No appointments yet
      </p>
    )
  }

  // Each slice's start is derived from the counts before it rather than a
  // running mutable cursor — O(n²) over at most five slices, and it keeps the
  // render pure.
  const arcs = slices.map((slice, i) => {
    const before = slices
      .slice(0, i)
      .reduce((sum, s) => sum + s.count, 0)

    const start = (before / total) * 360 + GAP_DEG / 2
    const end = ((before + slice.count) / total) * 360 - GAP_DEG / 2

    return { slice, path: arcPath(start, Math.max(end, start + 0.1)) }
  })

  const active = hovered
    ? slices.find((s) => s.status === hovered)
    : undefined

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-center">
      <div className="relative shrink-0">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="size-[200px]"
          role="img"
          aria-label={`Appointments by status: ${slices
            .map((s) => `${LABELS[s.status]} ${s.count}`)
            .join(', ')}`}
        >
          {arcs.map(({ slice, path }) => (
            <path
              key={slice.status}
              d={path}
              fill={SLICE_COLORS[slice.status]}
              className="cursor-default transition-opacity"
              opacity={hovered && hovered !== slice.status ? 0.35 : 1}
              onMouseEnter={() => setHovered(slice.status)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>

        {/* Hover readout sits in the hole, so the donut doubles as a stat tile. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums text-gray-900">
            {active ? active.count : total}
          </span>
          <span className="text-[11px] text-gray-500">
            {active ? LABELS[active.status] : 'Total'}
          </span>
        </div>
      </div>

      {/* Legend is always present — identity is never carried by colour alone. */}
      <ul className="flex w-full max-w-[220px] flex-col gap-2">
        {slices.map((slice) => (
          <li
            key={slice.status}
            className="flex items-center gap-2 text-sm"
            onMouseEnter={() => setHovered(slice.status)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: SLICE_COLORS[slice.status] }}
            />
            <span className="flex-1 truncate text-gray-600">
              {LABELS[slice.status]}
            </span>
            <span className="tabular-nums text-gray-400">{slice.count}</span>
            <span className="w-12 text-right tabular-nums font-medium text-gray-900">
              {slice.percentage}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
