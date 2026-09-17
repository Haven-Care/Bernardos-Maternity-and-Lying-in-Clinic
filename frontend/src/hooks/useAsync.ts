import { useCallback, useEffect, useRef, useState } from 'react'

export interface AsyncState<T> {
  data: T | undefined
  error: Error | undefined
  loading: boolean
  /** Re-run the loader — call after a mutation to pick up the new state. */
  reload: () => void
}

/**
 * Run an async loader and track loading / error / data.
 *
 * Deliberately small: the `src/api/` seam means swapping to a real backend
 * changes nothing here, so there's no need for a caching library yet. If
 * refetch-on-focus or shared caching becomes worth it later, TanStack Query
 * drops in behind the same call sites.
 *
 * `deps` works like `useEffect`'s — pass the values the loader closes over.
 *
 * Note: `loading` is only raised on mount and on an explicit `reload()`. When
 * `deps` change the previous data stays on screen while the new request runs,
 * rather than flashing a spinner. That is usually the better read for a table
 * whose filter just changed; if a screen genuinely needs the spinner, key the
 * component on the filter instead.
 */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: React.DependencyList = [],
): AsyncState<T> {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<Error>()
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)

  // Hold the latest loader without making it an effect dependency — an inline
  // arrow at the call site would otherwise re-fire the effect every render.
  // This effect is declared first so it commits before the loader effect below.
  const loaderRef = useRef(loader)
  useEffect(() => {
    loaderRef.current = loader
  })

  const reload = useCallback(() => {
    setLoading(true)
    setNonce((n) => n + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    loaderRef
      .current()
      .then((result) => {
        if (cancelled) return
        setData(result)
        setError(undefined)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    // Guards against a slow first response overwriting a fast second one, and
    // against setting state on an unmounted component.
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  return { data, error, loading, reload }
}
