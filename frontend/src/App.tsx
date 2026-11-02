import { RouterProvider } from 'react-router-dom'
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx'
import { ToastProvider } from './components/ui/Toast.tsx'
import { router } from './router.tsx'

function App() {
  return (
    <AppErrorBoundary>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </AppErrorBoundary>
  )
}

export default App
