import '../PortalPage.css'
import * as api from '../../../api'
import { Tabs, type Tab } from '../../../components/ui/Tabs'
import { LoadingState } from '../../../components/ui/states'
import { useActiveTab } from '../../../hooks/useActiveTab'
import { useAsync } from '../../../hooks/useAsync'
import { PatientAccounts } from './PatientAccounts'
import { ServicesPricing } from './ServicesPricing'
import { AppointmentSlots } from './AppointmentSlots'
import { ClinicInfo } from './ClinicInfo'

const TABS: Tab[] = [
  { id: 'patients', label: 'Patient Accounts' },
  { id: 'services', label: 'Services & Pricing' },
  { id: 'slots', label: 'Appointment Slots' },
  { id: 'clinic', label: 'Clinic Info' },
]

/**
 * Prices, open times and clinic details are the clinic's policy, and only an
 * administrator may change them (`adminOnly` in backend clinic.routes.ts). A
 * staff account is not shown forms whose every save would be refused.
 */
const ADMINISTRATOR_TABS = new Set(['services', 'slots', 'clinic'])

export function Administration() {
  const identity = useAsync(() => api.session.getIdentity())
  const isAdministrator = identity.data?.role === 'administrator'
  const tabs = isAdministrator ? TABS : TABS.filter((tab) => !ADMINISTRATOR_TABS.has(tab.id))
  const active = useActiveTab(tabs)

  if (identity.loading) return <LoadingState />

  return (
    <div className="portal-page flex w-full min-w-0 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Administration</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {isAdministrator
            ? 'Manage patient accounts, services, and clinic settings'
            : 'Manage patient accounts. Services, slots, and clinic details are changed by an administrator.'}
        </p>
      </div>

      <Tabs tabs={tabs} />

      {active === 'patients' && <PatientAccounts />}
      {active === 'services' && <ServicesPricing />}
      {active === 'slots' && <AppointmentSlots />}
      {active === 'clinic' && <ClinicInfo />}
    </div>
  )
}
