import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/pages/Layout'
import Dashboard from '@/pages/Dashboard'
import Watchlist from '@/pages/Watchlist'
import TradeLogs from '@/pages/TradeLogs'
import StockDetail from '@/pages/StockDetail'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index                       element={<Dashboard />} />
          <Route path="watchlist"            element={<Watchlist />} />
          <Route path="trades"               element={<TradeLogs />} />
          {/* 股票详情页：从任意地方点击股票代码跳转 */}
          <Route path="stocks/:code"         element={<StockDetail />} />
          <Route path="market"               element={<Navigate to="/" replace />} />
          <Route path="analysis"             element={<Navigate to="/" replace />} />
          <Route path="*"                    element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
