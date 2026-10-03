import { createBrowserRouter, Navigate } from 'react-router-dom'
import { PortalLayout } from './components/layout/PortalLayout.tsx'
import { RequireStaff } from './components/RequireStaff.tsx'
import { RequirePatient } from './components/RequirePatient.tsx'
import { SystemAccess } from './pages/portal/system/SystemAccess.tsx'
import { Dashboard } from './pages/portal/Dashboard.tsx'
import { Appointments } from './pages/portal/appointments/Appointments.tsx'
import { Inventory } from './pages/portal/inventory/Inventory.tsx'
import { PatientRecords } from './pages/portal/patients/PatientRecords.tsx'
import { Administration } from './pages/portal/administration/Administration.tsx'
import { BookingPage } from './pages/public/BookingPage.tsx'
import { Login } from './pages/auth/Login.tsx'
import { ForgotPassword } from './pages/auth/ForgotPassword.tsx'
import { VerifyCode } from './pages/auth/VerifyCode.tsx'
import { ResetPassword } from './pages/auth/ResetPassword.tsx'
import { ResetSuccess } from './pages/auth/ResetSuccess.tsx'
import { PatientLogin } from './pages/patient/PatientLogin.tsx'
import { SignUp } from './pages/patient/SignUp.tsx'
import { CheckEmail } from './pages/patient/CheckEmail.tsx'
import { MyBookings } from './pages/patient/MyBookings.tsx'
import { Account } from './pages/patient/Account.tsx'
import { NotFound } from './pages/NotFound.tsx'

/**
 * Two surfaces, one app.
 *
 * `/admin/*` is the staff command center, inside the portal shell. Everything
 * else is public: `/book` is the patient booking form, and the auth screens are
 * the way into the portal.
 *
 * `/` still lands on the portal rather than `/book`. Staff are the ones who open
 * this app by habit; patients arrive on a link the clinic sends them. Flip it if
 * the clinic ever points a public domain here.
 *
 * `/admin/*` sits behind `<RequireStaff>`, which redirects a signed-out visitor
 * to the login page. It decides what renders, not what is permitted — every
 * request the portal makes is authorized again in Express.
 *
 * `/admin/system` is deliberately absent from the sidebar. It provisions staff
 * accounts, which the Figma never designed a screen for, and it is
 * administrator-only both here and in the API.
 *
 * The reset screens carry the email forward in router state, so they are a
 * sequence rather than four independently reachable pages: each redirects back
 * to `/forgot-password` if that state is missing.
 *
 * `/patient/*` is the third surface: the patient's own account. Sign-up and
 * sign-in are open; `/patient/bookings` sits behind `<RequirePatient>`.
 *
 * The reset sequence is mounted **twice**, once per realm, because staff and
 * patients share one GoTrue and one recovery mechanism — only the destinations
 * differ. Each screen reads its realm from the path (`useAuthRealm`) rather
 * than existing as two near-identical copies.
 *
 * `/book` itself stays public. Steps 1 and 2 are browsable signed-out and only
 * the Details step demands an account, so a patient can see what the clinic
 * offers and when before deciding to register.
 */
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/admin" replace /> },

  { path: '/book', element: <BookingPage /> },

  { path: '/login', element: <Login /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/verify-code', element: <VerifyCode /> },
  { path: '/reset-password', element: <ResetPassword /> },
  { path: '/reset-success', element: <ResetSuccess /> },

  { path: '/patient/login', element: <PatientLogin /> },
  { path: '/patient/signup', element: <SignUp /> },
  { path: '/patient/check-email', element: <CheckEmail /> },
  { path: '/patient/forgot-password', element: <ForgotPassword /> },
  { path: '/patient/verify-code', element: <VerifyCode /> },
  { path: '/patient/reset-password', element: <ResetPassword /> },
  { path: '/patient/reset-success', element: <ResetSuccess /> },

  {
    element: <RequirePatient />,
    children: [
      { path: '/patient/bookings', element: <MyBookings /> },
      { path: '/patient/account', element: <Account /> },
    ],
  },

  {
    element: <RequireStaff />,
    children: [
      {
        path: '/admin',
        element: <PortalLayout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'appointments', element: <Appointments /> },
          { path: 'inventory', element: <Inventory /> },
          { path: 'patients', element: <PatientRecords /> },
          { path: 'administration', element: <Administration /> },

          // Unlisted. Nested again under an administrator-only guard, so a
          // staff member who types the URL lands back on the dashboard.
          {
            element: <RequireStaff role="administrator" />,
            children: [{ path: 'system', element: <SystemAccess /> }],
          },
        ],
      },
    ],
  },

  { path: '*', element: <NotFound /> },
])
