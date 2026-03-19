import { useEffect, useState, useCallback } from 'react'
import { Zap, X } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────
// Toast 数据结构
// ─────────────────────────────────────────────────────────────────

export interface ToastItem {
  id: string
  message: string       // 主文案
  sub?: string          // 副文案（价格等）
  type?: 'flash' | 'info' | 'warn'
  duration?: number     // 自动消失毫秒，默认 6000
}

// ─────────────────────────────────────────────────────────────────
// useToast hook（外部调用）
// ─────────────────────────────────────────────────────────────────

type ToastPush = (item: Omit<ToastItem, 'id'>) => void

let _push: ToastPush | null = null

export function useToastRegister(push: ToastPush) {
  useEffect(() => {
    _push = push
    return () => { _push = null }
  }, [push])
}

export function pushToast(item: Omit<ToastItem, 'id'>) {
  _push?.({ ...item, id: `${Date.now()}-${Math.random()}` })
}

// ─────────────────────────────────────────────────────────────────
// ToastContainer 组件（挂在页面顶层，右上角）
// ─────────────────────────────────────────────────────────────────

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const push = useCallback((item: Omit<ToastItem, 'id'>) => {
    const toast: ToastItem = { ...item, id: `${Date.now()}-${Math.random()}` }
    setToasts(prev => [toast, ...prev].slice(0, 5)) // 最多叠 5 条
  }, [])

  useToastRegister(push)

  const remove = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <ToastCard key={t.id} toast={t} onClose={() => remove(t.id)} />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// 单条 Toast 卡片
// ─────────────────────────────────────────────────────────────────

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const [visible, setVisible] = useState(false)
  const duration = toast.duration ?? 6000

  useEffect(() => {
    // 入场动画
    const t1 = setTimeout(() => setVisible(true), 10)
    // 自动消失
    const t2 = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 350) // 等出场动画结束
    }, duration)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [duration, onClose])

  const isFlash = toast.type === 'flash'
  const isWarn  = toast.type === 'warn'

  return (
    <div
      className={`
        pointer-events-auto flex items-start gap-3
        px-4 py-3 rounded-xl border shadow-2xl
        backdrop-blur-md
        transition-all duration-300
        ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}
        ${isFlash
          ? 'bg-orange-950/90 border-orange-500/50'
          : isWarn
            ? 'bg-yellow-950/90 border-yellow-500/50'
            : 'bg-gray-900/90 border-gray-600/50'
        }
        min-w-[240px] max-w-[320px]
      `}
    >
      {/* 图标 */}
      <div className={`mt-0.5 flex-shrink-0 ${isFlash ? 'text-orange-400' : 'text-yellow-400'}`}>
        <Zap size={15} className={isFlash ? 'animate-pulse' : ''} />
      </div>

      {/* 文案 */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-snug ${isFlash ? 'text-orange-200' : 'text-white'}`}>
          {toast.message}
        </p>
        {toast.sub && (
          <p className="text-[11px] font-mono text-gray-400 mt-0.5">{toast.sub}</p>
        )}
      </div>

      {/* 关闭 */}
      <button
        onClick={() => { setVisible(false); setTimeout(onClose, 350) }}
        className="flex-shrink-0 text-gray-500 hover:text-gray-300 transition-colors mt-0.5"
      >
        <X size={13} />
      </button>
    </div>
  )
}
