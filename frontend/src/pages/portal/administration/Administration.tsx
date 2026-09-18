import { Tabs, type Tab } from '../../../components/ui/Tabs'
import { useActiveTab } from '../../../hooks/useActiveTab'
import { MyAccount } from './MyAccount'
import { ServicesPricing } from './ServicesPricing'
import { AppointmentSlots } from './AppointmentSlots'
import { ClinicInfo } from './ClinicInfo'

const TABS: Tab[] = [
  { id: 'account', label: 'My Account' },
  { id: 'services', label: 'Services & Pricing' },
  { id: 'slots', label: 'Appointment Slots' },
  { id: 'clinic', label: 'Clinic Info' },
]

export function Administration() {
  const active = useActiveTab(TABS)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Administration</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Manage account, services, and clinic settings
        </p>
      </div>

      <Tabs tabs={TABS} />

      {active === 'account' && <MyAccount />}
      {active === 'services' && <ServicesPricing />}
      {active === 'slots' && <AppointmentSlots />}
      {active === 'clinic' && <ClinicInfo />}
    </div>
  )
}
