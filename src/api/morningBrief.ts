import http from './http'
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
  ai_pending:    boolean   // true = AI 点评正在后台生成，前端应轮询
  from_cache:    boolean
}

export const fetchMorningBrief = (force = false) =>
  http.get<ApiResponse<MorningBriefDTO>>('/morning-brief', {
    params: force ? { force: '1' } : {},
  })
