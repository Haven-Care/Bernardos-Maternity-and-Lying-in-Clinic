import * as api from '../../../api'
import { useAsync } from '../../../hooks/useAsync'
import { Tabs, type Tab } from '../../../components/ui/Tabs'
import { useActiveTab } from '../../../hooks/useActiveTab'
import { BookingRequests } from './BookingRequests'
import { CalendarWeek } from './CalendarWeek'
import { RescheduleQueue } from './RescheduleQueue'

export function Appointments() {
  /**
   * Counted here rather than inside the queue, because the number has to be
   * visible from the tab a staff member is already looking at. A queue nobody
   * opens is a queue nobody works — patients would sit waiting on a decision
   * that was never seen.
   */
  const pending = useAsync(() =>
    api.rescheduleRequests.listRescheduleRequests('pending'),
  )

  const tabs: Tab[] = [
    { id: 'requests', label: 'Booking Requests' },
    { id: 'reschedules', label: 'Reschedules', badge: pending.data?.length },
    { id: 'calendar', label: 'Calendar' },
  ]

  const active = useActiveTab(tabs)

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Appointment Management
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          View and manage patient appointments
        </p>
      </div>

      <Tabs tabs={tabs} />

      {active === 'requests' && <BookingRequests />}
      {active === 'reschedules' && (
        // Approving moves a booking, so the badge beside this tab is stale the
        // moment a decision lands.
        <RescheduleQueue onDecided={pending.reload} />
      )}
      {active === 'calendar' && <CalendarWeek />}
    </div>
  )
}
