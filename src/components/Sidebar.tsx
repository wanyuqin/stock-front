import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Star, ScrollText, ScanLine, Radar,
  Shield, Settings, ChevronRight, Brain, Newspaper,
  Target, Sunrise, TrendingUp, Flame, ShieldAlert, Database,
} from 'lucide-react'

const NAV_ITEMS = [
  {
    group: '市场',
    items: [
      { to: '/',               icon: LayoutDashboard, label: '仪表盘',     badge: null  },
      { to: '/morning-brief',  icon: Sunrise,         label: '开盘简报',   badge: null  },
      { to: '/watchlist',      icon: Star,            label: '自选股',     badge: null  },
      { to: '/buy-plans',      icon: Target,          label: '买入计划',   badge: null  },
      { to: '/scan',           icon: ScanLine,        label: '信号扫描',   badge: null  },
      { to: '/radar',          icon: Radar,           label: '机会雷达',   badge: null  },
      { to: '/sector-heatmap', icon: Flame,           label: '板块热力',   badge: null  },
      { to: '/intel',          icon: Newspaper,       label: '研报情报站', badge: null  },
      { to: '/kline-library',  icon: Database,        label: 'K线数据库',  badge: null  },
    ],
  },
  {
    group: '账户',
    items: [
      { to: '/guardian', icon: Shield,      label: '持仓守护', badge: null  },
      { to: '/review',   icon: Brain,       label: '深度复盘', badge: 'AI'  },
      { to: '/trades',   icon: ScrollText,  label: '交易日志', badge: null  },
      { to: '/equity',   icon: TrendingUp,  label: '账户绩效', badge: null  },
      { to: '/risk-center', icon: ShieldAlert, label: '风险中心', badge: null },
    ],
  },
]

function SidebarLogo() {
  return (
    <div className="px-4 py-5 border-b border-terminal-border">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-md bg-terminal-muted border border-terminal-border flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 20 20" className="w-4.5 h-4.5" fill="none">
            <polyline points="2,14 6,8 10,11 14,4 18,7" stroke="#00d97e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="18" cy="7" r="1.5" fill="#00d97e" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-ink-primary font-semibold text-sm leading-tight tracking-wide">A股分析</p>
          <p className="text-ink-muted text-xs font-mono mt-0.5">TERMINAL v0.2</p>
        </div>
      </div>
    </div>
  )
}

function MarketStatus() {
  const now   = new Date()
  const total = now.getHours() * 60 + now.getMinutes()
  const isOpen = (total >= 570 && total <= 690) || (total >= 780 && total <= 900)
  return (
    <div className="px-4 py-3 border-b border-terminal-border">
      <div className="flex items-center justify-between">
        <span className="text-ink-muted text-xs font-mono uppercase tracking-widest">A股市场</span>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-accent-green animate-pulse' : 'bg-ink-muted'}`} />
          <span className={`text-xs font-mono ${isOpen ? 'text-accent-green' : 'text-ink-muted'}`}>
            {isOpen ? '交易中' : '已收盘'}
          </span>
        </div>
      </div>
    </div>
  )
}

interface NavItemProps {
  to: string
  icon: React.ElementType
  label: string
  badge: string | null
}

function NavItem({ to, icon: Icon, label, badge }: NavItemProps) {
  const location = useLocation()
  const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
  return (
    <NavLink to={to} end={to === '/'}>
      <div className={`
        group relative flex items-center gap-3 px-3 py-2.5 rounded-lg mx-2 mb-0.5
        transition-all duration-150 cursor-pointer select-none
        ${isActive
          ? 'bg-terminal-muted border border-terminal-border text-ink-primary'
          : 'text-ink-secondary hover:text-ink-primary hover:bg-terminal-muted/50 border border-transparent'
        }
      `}>
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent-green rounded-full shadow-glow-green" />
        )}
        <Icon
          size={15}
          className={`flex-shrink-0 transition-colors ${isActive ? 'text-accent-green' : 'text-ink-muted group-hover:text-ink-secondary'}`}
          strokeWidth={isActive ? 2.2 : 1.8}
        />
        <span className="flex-1 text-sm font-medium">{label}</span>
        {badge && (
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-medium tracking-wide ${
            badge === 'NEW'
              ? 'bg-accent-green/15 text-accent-green border border-accent-green/30'
              : 'bg-accent-amber/10 text-accent-amber border border-accent-amber/20'
          }`}>
            {badge}
          </span>
        )}
        {isActive && <ChevronRight size={12} className="text-ink-muted" />}
      </div>
    </NavLink>
  )
}

function SidebarFooter() {
  return (
    <div className="border-t border-terminal-border p-3">
      <div className="px-2 py-2 mb-2">
        <p className="text-ink-muted text-[11px] font-mono mb-1.5 uppercase tracking-widest">快捷键</p>
        <div className="space-y-1">
          {[['/', '搜索股票'], ['R', '刷新行情']].map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-ink-muted text-xs">{desc}</span>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-terminal-muted border border-terminal-border text-ink-secondary">{key}</kbd>
            </div>
          ))}
        </div>
      </div>
      <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-terminal-muted transition-all duration-150 text-sm">
        <Settings size={14} strokeWidth={1.8} />
        <span>系统设置</span>
      </button>
    </div>
  )
}

export default function Sidebar() {
  return (
    <aside className="w-52 flex-shrink-0 h-screen flex flex-col bg-terminal-panel border-r border-terminal-border animate-slide-in">
      <SidebarLogo />
      <MarketStatus />
      <nav className="flex-1 overflow-y-auto py-3 space-y-4">
        {NAV_ITEMS.map((group) => (
          <div key={group.group}>
            <p className="px-5 mb-1.5 text-[11px] font-mono text-ink-muted uppercase tracking-widest">
              {group.group}
            </p>
            {group.items.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </div>
        ))}
      </nav>
      <SidebarFooter />
    </aside>
  )
}
