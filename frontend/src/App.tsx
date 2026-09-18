import { RouterProvider } from 'react-router-dom'
import { ToastProvider } from './components/ui/Toast.tsx'
import { router } from './router.tsx'

function App() {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  )
}

export default App
