import type { Quote } from '@/types'

// 涨跌颜色
export function getPriceColor(value: number): string {
  if (value > 0) return 'text-accent-green'
  if (value < 0) return 'text-accent-red'
  return 'text-ink-secondary'
}

// 格式化涨跌幅
export function formatRate(rate: number): string {
  const sign = rate > 0 ? '+' : ''
  return `${sign}${rate.toFixed(2)}%`
}

// 格式化价格
export function formatPrice(price: number): string {
  return price.toFixed(2)
}

// 格式化成交量（手 → 万手/亿手）
export function formatVolume(vol: number): string {
  if (vol >= 100_000_000) return `${(vol / 100_000_000).toFixed(2)}亿手`
  if (vol >= 10_000)      return `${(vol / 10_000).toFixed(0)}万手`
  return `${vol}手`
}

// 格式化成交额（元 → 亿元/万元）
export function formatAmount(amount: number): string {
  if (amount >= 1_0000_0000) return `${(amount / 1_0000_0000).toFixed(2)}亿`
  if (amount >= 10_000)      return `${(amount / 10_000).toFixed(0)}万`
  return `${amount.toFixed(0)}元`
}

interface QuoteTagProps {
  quote: Quote
  className?: string
}

// 行情徽章：价格 + 涨跌幅（小型，用于列表）
export function QuoteTag({ quote, className = '' }: QuoteTagProps) {
  const color = getPriceColor(quote.change_rate)
  return (
    <span className={`inline-flex items-center gap-2 font-mono text-sm ${className}`}>
      <span className="text-ink-primary">{formatPrice(quote.price)}</span>
      <span className={`text-xs ${color}`}>{formatRate(quote.change_rate)}</span>
    </span>
  )
}

// 空状态
export function EmptyState({ message = '暂无数据' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-ink-muted">
      <div className="w-12 h-12 rounded-full border border-terminal-border flex items-center justify-center mb-3">
        <span className="font-mono text-xl">∅</span>
      </div>
      <p className="text-sm">{message}</p>
    </div>
  )
}

// 加载骨架屏行
export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-terminal-border">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 bg-terminal-muted rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
        </td>
      ))}
    </tr>
  )
}

// 错误提示条
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-accent-red/10 border border-accent-red/30 rounded-lg text-accent-red text-sm font-mono">
      <span className="text-base">⚠</span>
      {message}
    </div>
  )
}
