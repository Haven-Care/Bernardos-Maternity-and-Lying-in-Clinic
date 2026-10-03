import { Link, useSearchParams } from 'react-router-dom'
import * as api from '../../api'
import { useAsync } from '../../hooks/useAsync'
import { AppointmentsPie } from '../../components/charts/AppointmentsPie'
import { Card, CardHeader } from '../../components/ui/Card'
import { SelectField } from '../../components/ui/fields'
import { StatTile, StatTileSkeleton } from '../../components/ui/StatTile'
import { AsyncBoundary, ErrorState } from '../../components/ui/states'
import {
  DASHBOARD_RANGES,
  type AlertSeverity,
  type DashboardRange,
} from '../../types/dashboard'

const RANGE_LABELS: Record<DashboardRange, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  'last-7-days': 'Last 7 days',
  'this-month': 'This month',
  'last-month': 'Last month',
  'all-time': 'All time',
}

function isDashboardRange(value: string | null): value is DashboardRange {
  return DASHBOARD_RANGES.some((r) => r === value)
}

/**
 * The range covers the stat tiles and the pie, so it sits in the page header
 * rather than on either card. Inventory Alerts is stock as of now and ignores
 * it.
 *
 * Kept in `?range=`, like the tabs elsewhere in the portal, so a refresh or a
 * shared link shows the same numbers.
 */
export function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const param = searchParams.get('range')
  const range: DashboardRange = isDashboardRange(param) ? param : 'today'

  const stats = useAsync(() => api.dashboard.getStats(range), [range])
  const overview = useAsync(
    () => api.dashboard.getAppointmentsOverview(range),
    [range],
  )
  const alerts = useAsync(() => api.dashboard.getUrgentAlerts())
  const profile = useAsync(() => api.account.getProfile())

  const firstName = profile.data?.fullName.split(' ')[0] ?? ''
  const isToday = range === 'today'

  function setRange(next: string) {
    const params = new URLSearchParams(searchParams)
    params.set('range', next)
    setSearchParams(params, { replace: true })
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {/* "Happening today" only while the numbers are today's. */}
            {[
              firstName && `Welcome back, ${firstName}.`,
              isToday && 'Here’s what’s happening today.',
            ]
              .filter(Boolean)
              .join(' ') || 'Clinic overview.'}
          </p>
        </div>
        <div className="w-40">
          <SelectField
            label="Date range"
            value={range}
            onChange={setRange}
            options={DASHBOARD_RANGES.map((r) => ({
              value: r,
              label: RANGE_LABELS[r],
            }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.error ? (
          <div className="col-span-full">
            <Card>
              <ErrorState error={stats.error} onRetry={stats.reload} />
            </Card>
          </div>
        ) : stats.data === undefined ? (
          <>
            <StatTileSkeleton />
            <StatTileSkeleton />
            <StatTileSkeleton />
            <StatTileSkeleton />
          </>
        ) : (
          <>
            {/* The design's labels for today; plain ones for any other range,
                where "Today's Schedule" would be wrong. */}
            <StatTile
              label={isToday ? "Today's Schedule" : 'Scheduled'}
              value={stats.data.todaysSchedule}
            />
            <StatTile
              label={isToday ? 'Booked Today' : 'Booked'}
              value={stats.data.bookedToday}
            />
            <StatTile
              label={isToday ? 'Completed Appointment' : 'Completed'}
              value={stats.data.completedAppointments}
            />
            <StatTile
              label="Inventory Alerts"
              value={stats.data.inventoryAlerts}
              tone={stats.data.inventoryAlerts > 0 ? 'warning' : 'default'}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Appointments Overview"
            action={
              <span className="text-xs font-medium text-brand-600">
                {RANGE_LABELS[range]}
              </span>
            }
          />
          <div className="p-5">
            <AsyncBoundary state={overview}>
              {(slices) => <AppointmentsPie slices={slices} />}
            </AsyncBoundary>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Urgent Alerts" />
          <AsyncBoundary
            state={alerts}
            empty={
              <p className="px-4 py-10 text-center text-sm text-gray-400">
                Nothing needs attention
              </p>
            }
          >
            {(rows) => (
              <ul className="flex max-h-[360px] flex-col gap-2 overflow-y-auto p-3">
                {rows.map((alert) => (
                  <li key={alert.id}>
                    <Link
                      to={alert.href}
                      className={`block rounded-r-md border-l-[3px] bg-gray-50/70 px-3 py-2.5 transition-colors hover:bg-gray-100 ${SEVERITY_BAR[alert.severity]}`}
                    >
                      <p className="text-sm leading-snug text-gray-700">
                        <span className="font-semibold text-gray-900">
                          {alert.subject}
                        </span>{' '}
                        {alert.message}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {alert.detail}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </AsyncBoundary>
        </Card>
      </div>
    </div>
  )
}

/**
 * Severity is carried by a left bar *and* the wording of the alert, never by
 * colour alone — these are reserved status colours, not a categorical ramp.
 */
const SEVERITY_BAR: Record<AlertSeverity, string> = {
  critical: 'border-danger-500',
  warning: 'border-warning-500',
  info: 'border-brand-500',
}
