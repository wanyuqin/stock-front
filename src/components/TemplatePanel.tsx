import { useState, useCallback, useEffect } from 'react'
import { Save, Trash2, Bell, BellOff, Plus, X, CheckCircle2, RefreshCw } from 'lucide-react'
import { ErrorBanner } from '@/components/shared'
import http from '@/api/http'
import type { ApiResponse } from '@/types'

interface TemplateParams {
  min_score:             number
  min_main_inflow_pct:   number
  require_bull_aligned:  boolean
  min_vol_ratio:         number
}

export interface ScreenerTemplate {
  id:           number
  name:         string
  description:  string
  params:       TemplateParams
  push_enabled: boolean
  created_at:   string
}

const fetchTemplates = () =>
  http.get<ApiResponse<{ items: ScreenerTemplate[]; count: number }>>('/screener/templates')

const createTemplate = (body: object) =>
  http.post<ApiResponse<ScreenerTemplate>>('/screener/templates', body)

const updateTemplate = (id: number, body: object) =>
  http.put<ApiResponse<ScreenerTemplate>>(`/screener/templates/${id}`, body)

const deleteTemplate = (id: number) =>
  http.delete<ApiResponse<{ deleted: number }>>(`/screener/templates/${id}`)

// ── 新建模板弹框 ──────────────────────────────────────────────────
function CreateTemplateDialog({ onClose, onSuccess }: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    min_score: '50',
    min_main_inflow_pct: '10',
    min_vol_ratio: '1.5',
    require_bull_aligned: false,
    push_enabled: false,
  })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.name.trim()) { setErr('请输入模板名称'); return }
    setLoading(true); setErr('')
    try {
      await createTemplate({
        name:        form.name.trim(),
        description: form.description.trim(),
        params: {
          min_score:             parseInt(form.min_score) || 0,
          min_main_inflow_pct:   parseFloat(form.min_main_inflow_pct) || 0,
          min_vol_ratio:         parseFloat(form.min_vol_ratio) || 0,
          require_bull_aligned:  form.require_bull_aligned,
        },
        push_enabled: form.push_enabled,
      })
      onSuccess()
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '创建失败')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = `w-full bg-terminal-muted border border-terminal-border rounded-md px-3 py-2
    text-sm font-mono text-ink-primary placeholder-ink-muted/40 focus:outline-none
    focus:border-accent-cyan/50 focus:ring-1 focus:ring-accent-cyan/20 transition-colors`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm">
      <div className="card w-[420px] shadow-panel animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-terminal-border">
          <span className="font-semibold text-sm text-ink-primary">新建筛选模板</span>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-mono text-ink-muted mb-1.5 uppercase tracking-wider">模板名称 *</label>
            <input type="text" placeholder="如：主力强势型" value={form.name}
              onChange={e => set('name', e.target.value)} className={inputCls} autoFocus />
          </div>
          <div>
            <label className="block text-[10px] font-mono text-ink-muted mb-1.5 uppercase tracking-wider">备注</label>
            <input type="text" placeholder="筛选策略说明…" value={form.description}
              onChange={e => set('description', e.target.value)} className={inputCls} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-mono text-ink-muted mb-1.5 uppercase tracking-wider">最低评分</label>
              <input type="number" min="0" max="100" value={form.min_score}
                onChange={e => set('min_score', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-ink-muted mb-1.5 uppercase tracking-wider">主力占比%</label>
              <input type="number" min="0" value={form.min_main_inflow_pct}
                onChange={e => set('min_main_inflow_pct', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-ink-muted mb-1.5 uppercase tracking-wider">量比≥</label>
              <input type="number" min="0" step="0.1" value={form.min_vol_ratio}
                onChange={e => set('min_vol_ratio', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.require_bull_aligned}
                onChange={e => set('require_bull_aligned', e.target.checked)}
                className="w-4 h-4 rounded accent-accent-cyan" />
              <span className="text-xs font-mono text-ink-secondary">要求多头排列</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.push_enabled}
                onChange={e => set('push_enabled', e.target.checked)}
                className="w-4 h-4 rounded accent-accent-amber" />
              <span className="text-xs font-mono text-ink-secondary">每日 16:00 定时推送</span>
            </label>
          </div>

          {err && <ErrorBanner message={err} />}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">取消</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-accent-cyan/15 border border-accent-cyan/40 text-accent-cyan hover:bg-accent-cyan/25 disabled:opacity-40 transition-all">
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            {loading ? '保存中…' : '保存模板'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 模板管理面板 ──────────────────────────────────────────────────
export default function TemplatePanel() {
  const [templates, setTemplates] = useState<ScreenerTemplate[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchTemplates()
      setTemplates(res.data.data?.items ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const togglePush = async (t: ScreenerTemplate) => {
    try {
      await updateTemplate(t.id, { push_enabled: !t.push_enabled })
      setTemplates(prev => prev.map(p => p.id === t.id ? { ...p, push_enabled: !p.push_enabled } : p))
    } catch (e) {
      console.error(e)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除这个筛选模板？')) return
    try {
      await deleteTemplate(id)
      setTemplates(prev => prev.filter(t => t.id !== id))
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono text-ink-muted uppercase tracking-wider">已保存的筛选模板</p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 text-xs font-mono text-accent-cyan hover:text-accent-cyan/80 transition-colors"
        >
          <Plus size={11} /> 新建模板
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-14 bg-terminal-muted animate-pulse rounded-lg" />)}
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-8 text-ink-muted text-xs">
          <Save size={20} className="mx-auto mb-2 opacity-30" />
          <p>暂无模板，点击「新建模板」保存当前筛选条件</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => {
            const p = t.params
            return (
              <div key={t.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-terminal-panel border border-terminal-border"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-primary">{t.name}</p>
                  <p className="text-[10px] font-mono text-ink-muted mt-0.5">
                    评分≥{p.min_score}
                    {p.min_main_inflow_pct > 0 && ` · 主力≥${p.min_main_inflow_pct}%`}
                    {p.min_vol_ratio > 0 && ` · 量比≥${p.min_vol_ratio}`}
                    {p.require_bull_aligned && ' · 多头排列'}
                  </p>
                </div>
                <button
                  onClick={() => togglePush(t)}
                  title={t.push_enabled ? '关闭推送' : '开启推送'}
                  className={`p-1.5 rounded-md transition-colors ${
                    t.push_enabled
                      ? 'text-accent-amber bg-accent-amber/10 border border-accent-amber/30'
                      : 'text-ink-muted hover:text-ink-secondary'
                  }`}
                >
                  {t.push_enabled ? <Bell size={13} /> : <BellOff size={13} />}
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="p-1.5 rounded-md text-ink-muted hover:text-accent-red transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && (
        <CreateTemplateDialog
          onClose={() => setShowCreate(false)}
          onSuccess={load}
        />
      )}
    </div>
  )
}
