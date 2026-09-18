import { Link } from 'react-router-dom'
import * as api from '../../api'
import { useAsync } from '../../hooks/useAsync'
import { AppointmentsPie } from '../../components/charts/AppointmentsPie'
import { Card, CardHeader } from '../../components/ui/Card'
import { StatTile, StatTileSkeleton } from '../../components/ui/StatTile'
import { AsyncBoundary, ErrorState } from '../../components/ui/states'
import type { AlertSeverity } from '../../types/dashboard'

export function Dashboard() {
  const stats = useAsync(() => api.dashboard.getStats())
  const overview = useAsync(() => api.dashboard.getAppointmentsOverview())
  const alerts = useAsync(() => api.dashboard.getUrgentAlerts())
  const profile = useAsync(() => api.account.getProfile())

  const firstName = profile.data?.fullName.split(' ')[0] ?? ''

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {firstName
            ? `Welcome back, ${firstName}. Here’s what’s happening today.`
            : 'Here’s what’s happening today.'}
        </p>
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
            <StatTile label="Today's Schedule" value={stats.data.todaysSchedule} />
            <StatTile label="Booking Requests" value={stats.data.bookingRequests} />
            <StatTile
              label="Completed Appointment"
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
                All time
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
                      <p className="text-[13px] leading-snug text-gray-700">
                        <span className="font-semibold text-gray-900">
                          {alert.subject}
                        </span>{' '}
                        {alert.message}
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-400">
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
