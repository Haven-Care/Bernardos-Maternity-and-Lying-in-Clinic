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
import { RecoveryCallback } from './pages/auth/RecoveryCallback'
import { OAuthCallback } from './pages/auth/OAuthCallback'
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
import { Home } from './pages/patient/Home.tsx'
import { UnsavedChangesGuard } from './components/UnsavedChangesGuard'
import { NotFound } from './pages/NotFound.tsx'

/** Shared login routes by server-verified role; legacy patient links stay valid. */
export const router = createBrowserRouter([{ element: <UnsavedChangesGuard />, children: [
  { path: '/', element: <Navigate to="/login" replace /> },

  { path: '/book', element: <BookingPage /> },

  { path: '/login', element: <Login /> },
  { path: '/admin/login', element: <Login /> },
  { path: '/auth/recovery', element: <RecoveryCallback /> },
  { path: '/auth/callback', element: <OAuthCallback /> },
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
      { path: '/patient/home', element: <Home /> },
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
] }])
