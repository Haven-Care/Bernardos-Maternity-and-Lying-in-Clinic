import { useEffect } from 'react'
import * as api from '../api'
import { useAsync } from './useAsync'

/** Re-read clinic rates when a patient returns from another tab or app. */
export function useActiveServices() {
  return useServiceList(false)
}

export function useClinicServiceCatalog() {
  return useServiceList(true)
}

function useServiceList(catalog: boolean) {
  const services = useAsync(() => catalog ? api.services.listServiceCatalog() : api.services.listActiveServices(), [catalog])
  const { reload } = services
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') reload() }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [reload])
  return services
}
