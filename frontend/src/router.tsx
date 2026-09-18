import { createBrowserRouter, Navigate } from 'react-router-dom'
import { PortalLayout } from './components/layout/PortalLayout.tsx'
import { Dashboard } from './pages/portal/Dashboard.tsx'
import { Appointments } from './pages/portal/appointments/Appointments.tsx'
import { Inventory } from './pages/portal/inventory/Inventory.tsx'
import { PatientRecords } from './pages/portal/patients/PatientRecords.tsx'
import { Administration } from './pages/portal/administration/Administration.tsx'
import { Login } from './pages/auth/Login.tsx'
import { ForgotPassword } from './pages/auth/ForgotPassword.tsx'
import { VerifyCode } from './pages/auth/VerifyCode.tsx'
import { ResetPassword } from './pages/auth/ResetPassword.tsx'
import { ResetSuccess } from './pages/auth/ResetSuccess.tsx'
import { NotFound } from './pages/NotFound.tsx'

/**
 * Two surfaces, one app.
 *
 * `/admin/*` is the staff command center, inside the portal shell. Everything
 * else is public: the auth screens now, and the patient booking form once it's
 * designed.
 *
 * No route guard yet — auth is Part B. When it lands, `/admin` gets wrapped in
 * a `<RequireRole>` and nothing else here changes.
 *
 * The reset screens carry the email forward in router state, so they are a
 * sequence rather than four independently reachable pages: each redirects back
 * to `/forgot-password` if that state is missing.
 */
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/admin" replace /> },

  { path: '/login', element: <Login /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/verify-code', element: <VerifyCode /> },
  { path: '/reset-password', element: <ResetPassword /> },
  { path: '/reset-success', element: <ResetSuccess /> },

  {
    path: '/admin',
    element: <PortalLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'appointments', element: <Appointments /> },
      { path: 'inventory', element: <Inventory /> },
      { path: 'patients', element: <PatientRecords /> },
      { path: 'administration', element: <Administration /> },
    ],
  },

  { path: '*', element: <NotFound /> },
])
