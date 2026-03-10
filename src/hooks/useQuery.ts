import { useState, useEffect, useCallback, useRef } from 'react'

interface UseQueryOptions<T> {
  enabled?: boolean
  refetchInterval?: number   // ms，轮询间隔（0 = 不轮询）
  onSuccess?: (data: T) => void
  onError?: (err: Error) => void
}

interface UseQueryResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * 通用数据请求 hook，支持轮询和手动刷新。
 * 用法：const { data, loading, error, refetch } = useQuery(() => fetchQuote('600519'), { refetchInterval: 5000 })
 */
export function useQuery<T>(
  queryFn: () => Promise<{ data: { data: T } }>,
  options: UseQueryOptions<T> = {},
): UseQueryResult<T> {
  const { enabled = true, refetchInterval = 0, onSuccess, onError } = options

  const [data, setData]       = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef  = useRef(true)

  const execute = useCallback(async () => {
    if (!mountedRef.current) return
    setLoading(true)
    setError(null)
    try {
      const res = await queryFn()
      if (!mountedRef.current) return
      setData(res.data.data)
      onSuccess?.(res.data.data)
    } catch (e) {
      if (!mountedRef.current) return
      const msg = e instanceof Error ? e.message : '未知错误'
      setError(msg)
      onError?.(e instanceof Error ? e : new Error(msg))
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [queryFn]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true
    if (!enabled) return

    execute()

    if (refetchInterval > 0) {
      timerRef.current = setInterval(execute, refetchInterval)
    }

    return () => {
      mountedRef.current = false
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [enabled, refetchInterval, execute])

  return { data, loading, error, refetch: execute }
}
