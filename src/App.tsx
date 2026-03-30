import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/pages/Layout'
import Dashboard from '@/pages/Dashboard'
import Watchlist from '@/pages/Watchlist'
import TradeLogs from '@/pages/TradeLogs'
import StockDetail from '@/pages/StockDetail'
import ScanPage from '@/pages/ScanPage'
import OpportunityRadar from '@/pages/OpportunityRadar'
import PortfolioGuardian from '@/pages/PortfolioGuardian'
import TradeReviewHub from '@/pages/TradeReviewHub'
import IntelStation from '@/pages/IntelStation'
import BuyPlanPage from '@/pages/BuyPlanPage'
import MorningBriefPage from '@/pages/MorningBriefPage'
import EquityCurvePage from '@/pages/EquityCurvePage'
import SectorHeatmapPage from '@/pages/SectorHeatmapPage'
import RiskCenterPage from '@/pages/RiskCenterPage'
import KlineLibraryPage from '@/pages/KlineLibraryPage'
import ReportToast from '@/components/ReportToast'

export default function App() {
  return (
    <BrowserRouter>
      <ReportToast />
      <Routes>
        <Route element={<Layout />}>
          <Route index                  element={<Dashboard />}          />
          <Route path="morning-brief"   element={<MorningBriefPage />}   />
          <Route path="watchlist"       element={<Watchlist />}          />
          <Route path="buy-plans"       element={<BuyPlanPage />}        />
          <Route path="trades"          element={<TradeLogs />}          />
          <Route path="review"          element={<TradeReviewHub />}     />
          <Route path="scan"            element={<ScanPage />}           />
          <Route path="radar"           element={<OpportunityRadar />}   />
          <Route path="guardian"        element={<PortfolioGuardian />}  />
          <Route path="intel"           element={<IntelStation />}       />
          <Route path="equity"          element={<EquityCurvePage />}    />
          <Route path="sector-heatmap"  element={<SectorHeatmapPage />}  />
          <Route path="risk-center"     element={<RiskCenterPage />}     />
          <Route path="kline-library"   element={<KlineLibraryPage />}   />
          <Route path="stocks/:code"    element={<StockDetail />}        />
          <Route path="*"               element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
