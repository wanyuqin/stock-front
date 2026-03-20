import http from './http'
import { resolveMarketSource } from './marketSource'
import type { ApiResponse } from '@/types'

export interface ScoreItem {
  name:      string
  score:     number
  max:       number
  level:     'good' | 'normal' | 'bad'
  desc:      string
}

export interface StockScoreDTO {
  code:          string
  name:          string
  total_score:   number
  verdict:       string
  verdict_level: 'go' | 'caution' | 'no'
  items:         ScoreItem[]
  summary:       string
  current_price: number
  ma20:          number
  support:       number
  resistance:    number
  atr:           number
}

export const fetchStockScore = (code: string, source?: string) =>
  http.get<ApiResponse<StockScoreDTO>>(`/stocks/${code}/score`, {
    params: { source: resolveMarketSource(source) },
  })
