import http, { AI_TIMEOUT } from './http'
import type { ApiResponse } from '@/types'

export interface MorningBriefSection {
  title:  string
  items:  string[]
  level:  'normal' | 'warning' | 'danger' | 'info'
}

export interface MorningBriefDTO {
  date:          string
  generated_at:  string
  market_mood:   'SAFE' | 'WARNING' | 'DANGER'
  mood_score:    number
  mood_summary:  string
  sections:      MorningBriefSection[]
  ai_comment:    string
  ai_pending:    boolean
  from_cache:    boolean
}

// 旧接口（全量，向后兼容）
export const fetchMorningBrief = (force = false) =>
  http.get<ApiResponse<MorningBriefDTO>>('/morning-brief', {
    params: force ? { force: '1' } : {},
  })

// ── 独立 section 接口 ─────────────────────────────────────────────

export interface MarketSectionResult {
  section:      MorningBriefSection
  market_mood:  'SAFE' | 'WARNING' | 'DANGER'
  mood_score:   number
  mood_summary: string
}

export interface AICommentResult {
  ai_comment: string
  ready:      boolean
}

export const fetchSectionMarket    = () =>
  http.get<ApiResponse<MarketSectionResult>>('/morning-brief/sections/market')

export const fetchSectionPosition  = () =>
  http.get<ApiResponse<MorningBriefSection>>('/morning-brief/sections/position')

export const fetchSectionBuyPlans  = () =>
  http.get<ApiResponse<MorningBriefSection>>('/morning-brief/sections/buy-plans')

export const fetchSectionReports   = () =>
  http.get<ApiResponse<MorningBriefSection>>('/morning-brief/sections/reports')

export const fetchSectionValuation = () =>
  http.get<ApiResponse<MorningBriefSection>>('/morning-brief/sections/valuation')

export const fetchSectionNews      = () =>
  http.get<ApiResponse<MorningBriefSection>>('/morning-brief/sections/news', {
    timeout: AI_TIMEOUT,
  })

export const fetchSectionExternal  = () =>
  http.get<ApiResponse<MorningBriefSection>>('/morning-brief/sections/external')

export const fetchAIComment        = () =>
  http.get<ApiResponse<AICommentResult>>('/morning-brief/sections/ai-comment')
