export type MarketSource = 'qq' | 'em'

type RuntimeMarketSourceGlobal = typeof globalThis & {
  __MARKET_SOURCE_DEFAULT__?: string
}

function detectDefaultSource(): MarketSource {
  const globalSource = ((globalThis as RuntimeMarketSourceGlobal).__MARKET_SOURCE_DEFAULT__ ?? '').toLowerCase()
  const localSource = (() => {
    try {
      return (globalThis.localStorage?.getItem('market_source_default') ?? '').toLowerCase()
    } catch {
      return ''
    }
  })()
  const s = globalSource || localSource
  return s === 'em' ? 'em' : 'qq'
}

export const DEFAULT_MARKET_SOURCE: MarketSource = detectDefaultSource()

export function resolveMarketSource(source?: string): MarketSource {
  const s = (source ?? '').toLowerCase().trim()
  if (s === 'em' || s === 'eastmoney' || s === 'dfcf') return 'em'
  if (s === 'qq' || s === 'tencent' || s === 'tx') return 'qq'
  return DEFAULT_MARKET_SOURCE
}
