import { useCallback, useEffect, useState } from 'react'

interface FetchState<T> {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
}

/**
 * Runs `fetcher` whenever `deps` change, and optionally re-runs it every `pollMs`.
 * Stale responses from earlier deps are ignored.
 */
export function useFetch<T>(fetcher: () => Promise<T>, deps: unknown[], pollMs?: number): FetchState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const run = () =>
      fetcher()
        .then((result) => {
          if (cancelled) return
          setData(result)
          setError(null)
        })
        .catch((err: Error) => !cancelled && setError(err.message))
        .finally(() => !cancelled && setLoading(false))

    run()
    const id = pollMs ? setInterval(run, pollMs) : undefined
    return () => {
      cancelled = true
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, pollMs])

  return { data, error, loading, reload }
}
