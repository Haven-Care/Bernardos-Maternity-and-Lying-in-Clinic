import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './components/layout/Layout.tsx'
import { Home } from './pages/Home.tsx'
import { Booking } from './pages/Booking.tsx'
import { Inventory } from './pages/Inventory.tsx'
import { NotFound } from './pages/NotFound.tsx'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'booking', element: <Booking /> },
      { path: 'inventory', element: <Inventory /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
