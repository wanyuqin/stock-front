import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/pages/Layout'
import Dashboard from '@/pages/Dashboard'
import Watchlist from '@/pages/Watchlist'
import TradeLogs from '@/pages/TradeLogs'
import StockDetail from '@/pages/StockDetail'
import ScanPage from '@/pages/ScanPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index                element={<Dashboard />}   />
          <Route path="watchlist"     element={<Watchlist />}   />
          <Route path="trades"        element={<TradeLogs />}   />
          <Route path="scan"          element={<ScanPage />}    />
          <Route path="stocks/:code"  element={<StockDetail />} />
          <Route path="*"             element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
