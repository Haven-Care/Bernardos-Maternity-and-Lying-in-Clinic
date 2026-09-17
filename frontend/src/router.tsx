import { createBrowserRouter, Navigate } from 'react-router-dom'
import { PortalLayout } from './components/layout/PortalLayout.tsx'
import { Dashboard } from './pages/portal/Dashboard.tsx'
import {
  Administration,
  Appointments,
  Inventory,
  PatientRecords,
} from './pages/portal/stubs.tsx'
import { Login } from './pages/auth/Login.tsx'
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
 */
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/admin" replace /> },
  { path: '/login', element: <Login /> },

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
