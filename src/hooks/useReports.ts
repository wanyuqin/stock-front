import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchReports, fetchReportCount, type FetchReportsParams } from '@/api/report'
import type { StockReport } from '@/types'

const PAGE_SIZE = 20
const POLL_INTERVAL = 30 * 60 * 1000 // 30 分钟

interface UseReportsOptions {
  stockCode?: string   // 联动筛选：传入则只显示该股票的研报
  ratingFilter?: 'all' | 'buy'
  timeFilter?: 'all' | 'today' | 'week'
}

interface UseReportsResult {
  items: StockReport[]
  total: number
  loading: boolean
  loadingMore: boolean
  error: string | null
  hasMore: boolean
  newCount: number          // 距上次加载后新增的条数（用于 banner）
  loadMore: () => void
  refresh: () => void
  dismissNewBanner: () => void
}

export function useReports(options: UseReportsOptions = {}): UseReportsResult {
  const { stockCode, ratingFilter = 'all', timeFilter = 'all' } = options

  const [items, setItems]           = useState<StockReport[]>([])
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(1)
  const [loading, setLoading]       = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [newCount, setNewCount]     = useState(0)

  // 记录上次拉取时的 total，用于对比计算新增数
  const lastTotalRef = useRef<number | null>(null)
  const mountedRef   = useRef(true)

  // ── 应用前端过滤 ────────────────────────────────────────────────
  const applyFilters = useCallback((raw: StockReport[]): StockReport[] => {
    let result = raw

    if (ratingFilter === 'buy') {
      result = result.filter(r => r.rating_name === '买入')
    }

    if (timeFilter === 'today') {
      const todayStr = new Date().toISOString().slice(0, 10)
      result = result.filter(r => r.publish_date.startsWith(todayStr))
    } else if (timeFilter === 'week') {
      const weekAgo = new Date(Date.now() - 7 * 86400 * 1000)
      result = result.filter(r => new Date(r.publish_date) >= weekAgo)
    }

    return result
  }, [ratingFilter, timeFilter])

  // ── 首次加载 / 刷新 ─────────────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    setPage(1)

    try {
      const params: FetchReportsParams = { page: 1, limit: PAGE_SIZE }
      if (stockCode) params.stock_code = stockCode

      const res = await fetchReports(params)
      if (!mountedRef.current) return

      const { total: t, items: raw } = res.data.data
      setTotal(t)
      setItems(applyFilters(raw ?? []))
      setPage(2)

      // 计算新增数（仅首次加载后才开始对比）
      if (lastTotalRef.current !== null && t > lastTotalRef.current) {
        setNewCount(t - lastTotalRef.current)
      }
      lastTotalRef.current = t
    } catch (e) {
      if (!mountedRef.current) return
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      if (mountedRef.current && !silent) setLoading(false)
    }
  }, [stockCode, applyFilters])

  // ── 加载更多（无限滚动） ─────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (loadingMore || items.length >= total) return
    setLoadingMore(true)

    try {
      const params: FetchReportsParams = { page, limit: PAGE_SIZE }
      if (stockCode) params.stock_code = stockCode

      const res = await fetchReports(params)
      if (!mountedRef.current) return

      const { items: raw } = res.data.data
      const filtered = applyFilters(raw ?? [])
      setItems(prev => {
        // 去重（切换过滤器后 page 可能重叠）
        const ids = new Set(prev.map(r => r.id))
        return [...prev, ...filtered.filter(r => !ids.has(r.id))]
      })
      setPage(p => p + 1)
    } catch (e) {
      if (!mountedRef.current) return
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      if (mountedRef.current) setLoadingMore(false)
    }
  }, [page, items.length, total, loadingMore, stockCode, applyFilters])

  // ── 30 分钟轮询（静默，只更新新增计数） ──────────────────────────
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetchReportCount(stockCode)
        if (!mountedRef.current) return
        const newTotal = res.data.data?.total ?? 0
        if (lastTotalRef.current !== null && newTotal > lastTotalRef.current) {
          setNewCount(newTotal - lastTotalRef.current)
        }
      } catch {
        // 静默失败，不展示错误
      }
    }, POLL_INTERVAL)

    return () => clearInterval(timer)
  }, [stockCode])

  // ── 切换参数时重置 ───────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true
    load()
    return () => { mountedRef.current = false }
  }, [load])

  const refresh = useCallback(() => {
    setNewCount(0)
    load()
  }, [load])

  const dismissNewBanner = useCallback(() => {
    setNewCount(0)
  }, [])

  return {
    items,
    total,
    loading,
    loadingMore,
    error,
    hasMore: items.length < total,
    newCount,
    loadMore,
    refresh,
    dismissNewBanner,
  }
}
