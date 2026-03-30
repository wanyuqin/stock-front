# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev         # Start Vite dev server on :5173 (proxies /api to :8888)
npm run build       # TypeScript compile + Vite build → dist/
npm run lint        # ESLint on .ts/.tsx files
npm run preview     # Preview production build
```

Backend API must be running on `:8888` for the app to function. See `../stock-backend/` for backend setup.

## Architecture

### Routing & Layout

Routes are defined in `src/App.tsx`. All routes share a `<Layout>` wrapper (`src/pages/Layout.tsx`) that renders `<Sidebar>` + `<Outlet>`. Page components live in `src/pages/`.

Navigation is split into two sidebar groups: 市场 (Market: Dashboard, MorningBrief, Watchlist, BuyPlans, Scan, Radar, SectorHeatmap, Intel, KlineLibrary) and 账户 (Account: PortfolioGuardian, TradeReviewHub, TradeLogs, EquityCurve, RiskCenter). Individual stocks route to `/stocks/:code` → `StockDetail`.

### API Layer

`src/api/http.ts` exports a configured Axios instance with base URL `/api/v1`. All responses are expected as `{ code: 0, message: string, data: T }` — the interceptor throws if `code !== 0`.

Two timeout constants matter:
- `DEFAULT_TIMEOUT = 15_000` — used for all regular calls
- `AI_TIMEOUT = 180_000` — used for AI analysis endpoints (pass as Axios config)

API calls are split into modules by domain: `stock.ts`, `buyPlan.ts`, `review.ts`, `report.ts`, `morningBrief.ts`, `risk.ts`, `klineSync.ts`.

### Data Fetching

`src/hooks/useQuery.ts` is the generic fetching hook used across all pages:

```typescript
const { data, loading, error, refetch } = useQuery(
  useCallback(() => apiFn(), [deps]),
  { refetchInterval: 15_000 }  // 0 = no polling
)
```

Pages typically show `<SkeletonRow>` while loading, `<EmptyState>` when empty, and `<ErrorBanner>` on error.

### Type Definitions

- `src/types/index.ts` — all core domain types (Stock, Quote, KLine, TradeLog, PositionDetail, etc.)
- `src/types/buy_plan.ts` — BuyPlan with status state machine: `WATCHING → READY → EXECUTED/ABANDONED/EXPIRED`
- `src/types/review.ts` — trade review, AI audit, behavioral stats
- `src/types/risk.ts` — risk management types

### Styling

Tailwind with a terminal dark theme. Key CSS variables are defined in `tailwind.config.js`:
- Backgrounds: `terminal-bg` (#0a0e14), `terminal-panel` (#131920), `terminal-border` (#1e2d3d)
- Accents: `accent-green` (#00d97e = buy/positive), `accent-red` (#ff4d6a = sell/negative)
- Text: `ink-primary` (#e8edf3), `ink-secondary` (#7a8fa6), `ink-muted` (#3d5166)
- Fonts: JetBrains Mono for prices/data (`font-mono`), DM Sans for UI (`font-sans`)

### Charting

- **ECharts** (`echarts` + `echarts-for-react`) — complex financial charts: K-lines, candlesticks
- **Recharts** — simpler comparative charts: equity curve, scatter plots

### Shared Components

`src/components/shared.tsx` contains layout utilities and formatters used throughout:
- `getPriceColor(val)` — returns Tailwind color class based on sign
- `formatRate()`, `formatPrice()`, `formatVolume()`, `formatAmount()`
- `QuoteTag`, `EmptyState`, `SkeletonRow`, `ErrorBanner`

Page headers consistently use `<Topbar title="..." subtitle="..." onRefresh={refetch} loading={loading} />`.

### Global Toast

`<ReportToast>` in `App.tsx` provides app-wide notifications. Import `pushToast()` from `src/components/Toast.tsx` to trigger from anywhere.
