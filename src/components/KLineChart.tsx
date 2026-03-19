import { useRef, useEffect } from 'react'
import * as echarts from 'echarts'
import type { KLineResponse } from '@/types'
import type { BuyPlan } from '@/types/buy_plan'

interface KLineChartProps {
  data: KLineResponse
  height?: number
  costPrice?: number
  /** 该股的买入计划列表，用于标注价格线 */
  buyPlans?: BuyPlan[]
}

// ── 均线计算 ──────────────────────────────────────────────────────
function calcMA(period: number, data: [number, number, number, number][]): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null
    const sum = data.slice(i - period + 1, i + 1).reduce((acc, d) => acc + d[1], 0)
    return parseFloat((sum / period).toFixed(3))
  })
}

// ── 买入计划 markLine 数据构建 ────────────────────────────────────
interface PlanMarkLineData {
  yAxis: number
  name:  string
  label: { formatter: string; color: string; backgroundColor: string }
  lineStyle: { color: string; width: number; type: 'dashed' | 'solid' }
}

function buildPlanMarkLines(plans: BuyPlan[]): PlanMarkLineData[] {
  const lines: PlanMarkLineData[] = []

  const active = plans.filter(
    p => p.status === 'WATCHING' || p.status === 'READY'
  )

  active.forEach(plan => {
    // 买入价（绿色区间下限）
    if (plan.buy_price != null) {
      const isTriggered = plan.trigger_hit
      lines.push({
        yAxis: plan.buy_price,
        name:  '买入价',
        label: {
          formatter: `买入 ¥${plan.buy_price.toFixed(2)}${plan.buy_price_high ? `~${plan.buy_price_high.toFixed(2)}` : ''}`,
          color: isTriggered ? '#ffffff' : '#4ade80',
          backgroundColor: isTriggered ? 'rgba(74,222,128,0.85)' : 'rgba(22,101,52,0.80)',
        },
        lineStyle: {
          color: isTriggered ? '#4ade80' : '#16a34a',
          width: isTriggered ? 2 : 1.5,
          type: 'dashed',
        },
      })
    }

    // 买入价上限（绿色区间上限，虚线）
    if (plan.buy_price != null && plan.buy_price_high != null) {
      lines.push({
        yAxis: plan.buy_price_high,
        name:  '买入上限',
        label: {
          formatter: `买入上限 ¥${plan.buy_price_high.toFixed(2)}`,
          color: '#86efac',
          backgroundColor: 'rgba(22,101,52,0.60)',
        },
        lineStyle: { color: '#16a34a', width: 1, type: 'dashed' },
      })
    }

    // 目标价（蓝色实线）
    if (plan.target_price != null) {
      const retPct = plan.buy_price
        ? ((plan.target_price - plan.buy_price) / plan.buy_price * 100).toFixed(1)
        : null
      lines.push({
        yAxis: plan.target_price,
        name:  '目标价',
        label: {
          formatter: `目标 ¥${plan.target_price.toFixed(2)}${retPct ? ` +${retPct}%` : ''}`,
          color: '#93c5fd',
          backgroundColor: 'rgba(30,64,175,0.80)',
        },
        lineStyle: { color: '#3b82f6', width: 1.5, type: 'dashed' },
      })
    }

    // 止损价（红色虚线）
    if (plan.stop_loss_price != null) {
      const lossPct = plan.buy_price
        ? ((plan.stop_loss_price - plan.buy_price) / plan.buy_price * 100).toFixed(1)
        : null
      lines.push({
        yAxis: plan.stop_loss_price,
        name:  '止损价',
        label: {
          formatter: `止损 ¥${plan.stop_loss_price.toFixed(2)}${lossPct ? ` ${lossPct}%` : ''}`,
          color: '#fca5a5',
          backgroundColor: 'rgba(127,29,29,0.80)',
        },
        lineStyle: { color: '#ef4444', width: 1.5, type: 'dashed' },
      })
    }
  })

  return lines
}

// ── 构建 ECharts option ───────────────────────────────────────────
function buildOption(
  data: KLineResponse,
  costPrice?: number,
  buyPlans?: BuyPlan[],
): echarts.EChartsOption {
  const ma5  = calcMA(5,  data.ohlc_data)
  const ma10 = calcMA(10, data.ohlc_data)
  const ma20 = calcMA(20, data.ohlc_data)

  const defaultStart = Math.max(0, Math.round((1 - 60 / Math.max(data.dates.length, 1)) * 100))

  // ── 合并所有 markLine 数据（持仓成本 + 买入计划价格线）─────────
  const allMarkLines: any[] = []

  if (costPrice != null) {
    allMarkLines.push({
      yAxis: costPrice,
      name: '持仓成本',
      label: {
        show: true, position: 'insideEndTop',
        formatter: `持仓 ¥${costPrice.toFixed(2)}`,
        color: '#fbbf24', fontSize: 11,
        fontFamily: 'JetBrains Mono, monospace', fontWeight: 600,
        backgroundColor: 'rgba(13,17,23,0.80)', padding: [3, 7], borderRadius: 3,
      },
      lineStyle: { color: '#fbbf24', width: 1.5, type: 'dashed' as const },
    })
  }

  if (buyPlans && buyPlans.length > 0) {
    const planLines = buildPlanMarkLines(buyPlans)
    planLines.forEach(l => {
      allMarkLines.push({
        yAxis: l.yAxis,
        name: l.name,
        label: {
          show: true,
          position: 'insideEndBottom',
          formatter: l.label.formatter,
          color: l.label.color,
          fontSize: 10,
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: 600,
          backgroundColor: l.label.backgroundColor,
          padding: [2, 6],
          borderRadius: 3,
        },
        lineStyle: { ...l.lineStyle },
      })
    })
  }

  // 买入价区间填充（markArea）
  const markAreaData: any[] = []
  if (buyPlans) {
    buyPlans
      .filter(p => (p.status === 'WATCHING' || p.status === 'READY') && p.buy_price != null)
      .forEach(plan => {
        const lo = plan.buy_price!
        const hi = plan.buy_price_high ?? lo * 1.005
        markAreaData.push([
          { yAxis: lo, itemStyle: { color: 'rgba(22,163,74,0.06)', borderWidth: 0 } },
          { yAxis: hi },
        ])
      })
  }

  return {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 300,

    grid: [
      { left: 60, right: 12, top: 32, bottom: 90 },
      { left: 60, right: 12, top: 'auto', bottom: 30, height: 56 },
    ],

    legend: {
      top: 4, left: 8,
      textStyle: { color: '#7a8fa6', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
      inactiveColor: '#3d5166',
      itemWidth: 12, itemHeight: 2,
      data: ['K线', 'MA5', 'MA10', 'MA20'],
    },

    toolbox: {
      right: 12, top: 2,
      feature: {
        dataZoom: { show: true, title: { zoom: '缩放', back: '还原' } },
        restore:  { show: true, title: '还原' },
      },
      iconStyle: { borderColor: '#3d5166' },
      emphasis: { iconStyle: { borderColor: '#7a8fa6' } },
    },

    xAxis: [
      {
        type: 'category', data: data.dates,
        gridIndex: 0, scale: true, boundaryGap: false,
        axisLine:  { lineStyle: { color: '#1e2d3d' } },
        axisTick:  { show: false },
        axisLabel: { show: false },
        splitLine: { show: true, lineStyle: { color: '#1e2d3d', type: 'dashed' } },
        min: 'dataMin', max: 'dataMax',
      },
      {
        type: 'category', data: data.dates,
        gridIndex: 1, scale: true, boundaryGap: false,
        axisLine:  { onZero: false, lineStyle: { color: '#1e2d3d' } },
        axisTick:  { show: false },
        axisLabel: {
          color: '#3d5166', fontSize: 10,
          fontFamily: 'JetBrains Mono, monospace',
          formatter: (val: string) => val.slice(5),
        },
        splitLine: { show: false },
        min: 'dataMin', max: 'dataMax',
      },
    ],

    yAxis: [
      {
        scale: true, gridIndex: 0, splitNumber: 4,
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: '#3d5166', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' },
        splitLine: { lineStyle: { color: '#1e2d3d', type: 'dashed' } },
        position: 'right',
      },
      {
        scale: true, gridIndex: 1, splitNumber: 2,
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: {
          color: '#3d5166', fontSize: 9,
          fontFamily: 'JetBrains Mono, monospace',
          formatter: (val: number) => val >= 10000 ? `${(val / 10000).toFixed(0)}万` : String(val),
        },
        splitLine: { show: false },
        position: 'right',
      },
    ],

    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1], start: defaultStart, end: 100 },
      {
        type: 'slider', xAxisIndex: [0, 1],
        bottom: 0, height: 20,
        start: defaultStart, end: 100,
        borderColor: '#1e2d3d', backgroundColor: '#0d1117',
        fillerColor: 'rgba(30,45,61,0.5)',
        handleStyle: { color: '#3d5166' },
        textStyle: { color: '#3d5166', fontSize: 10 },
        dataBackground: { lineStyle: { color: '#1e2d3d' }, areaStyle: { color: '#131920' } },
        selectedDataBackground: { lineStyle: { color: '#3d5166' }, areaStyle: { color: '#1c2a38' } },
      },
    ],

    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        crossStyle: { color: '#3d5166' },
        lineStyle: { color: '#3d5166', type: 'dashed' },
      },
      backgroundColor: '#0d1117',
      borderColor: '#1e2d3d',
      padding: [8, 12],
      textStyle: { color: '#e8edf3', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' },
      formatter: (params: any) => {
        if (!Array.isArray(params) || !params.length) return ''
        const kp = params.find((p: any) => p.seriesName === 'K线')
        if (!kp) return ''
        const [open, close, low, high] = kp.value as number[]
        const isUp = close >= open
        const c = isUp ? '#00d97e' : '#ff4d6a'
        const vp = params.find((p: any) => p.seriesName === '成交量')
        const vol: number = vp ? vp.value[1] : 0
        const pct = open > 0 ? (((close - open) / open) * 100).toFixed(2) : '—'
        const costRow = costPrice != null
          ? `<tr><td style="color:#fbbf24">持仓成本</td><td style="color:#fbbf24;text-align:right">¥${costPrice.toFixed(2)}</td></tr>
             <tr><td style="color:#fbbf24">持仓盈亏</td><td style="color:${close >= costPrice ? '#00d97e' : '#ff4d6a'};text-align:right;font-weight:600">${close >= costPrice ? '+' : ''}${(((close - costPrice) / costPrice) * 100).toFixed(2)}%</td></tr>`
          : ''

        // 买入计划参考价提示
        let planRows = ''
        if (buyPlans && buyPlans.length > 0) {
          const active = buyPlans.filter(p => p.status === 'WATCHING' || p.status === 'READY')
          active.forEach(plan => {
            if (plan.buy_price != null) {
              const distPct = ((close - plan.buy_price) / plan.buy_price * 100).toFixed(1)
              planRows += `<tr><td style="color:#4ade80">买入区间</td><td style="color:#4ade80;text-align:right">¥${plan.buy_price.toFixed(2)} (${distPct > '0' ? '+' : ''}${distPct}%)</td></tr>`
            }
            if (plan.target_price != null) {
              const distPct = ((plan.target_price - close) / close * 100).toFixed(1)
              planRows += `<tr><td style="color:#93c5fd">目标价</td><td style="color:#93c5fd;text-align:right">¥${plan.target_price.toFixed(2)} (+${distPct}%)</td></tr>`
            }
            if (plan.stop_loss_price != null) {
              const distPct = ((close - plan.stop_loss_price) / close * 100).toFixed(1)
              planRows += `<tr><td style="color:#fca5a5">止损价</td><td style="color:#fca5a5;text-align:right">¥${plan.stop_loss_price.toFixed(2)} (-${distPct}%)</td></tr>`
            }
          })
        }

        return `
          <div style="min-width:180px;line-height:1.6">
            <div style="color:#7a8fa6;font-size:11px;margin-bottom:5px">${kp.axisValue}</div>
            <table style="width:100%;font-size:12px;border-collapse:collapse">
              <tr><td style="color:#7a8fa6">开盘</td><td style="color:${c};text-align:right">${open.toFixed(2)}</td></tr>
              <tr><td style="color:#7a8fa6">收盘</td><td style="color:${c};text-align:right;font-weight:600">${close.toFixed(2)}</td></tr>
              <tr><td style="color:#7a8fa6">最高</td><td style="color:#00d97e;text-align:right">${high.toFixed(2)}</td></tr>
              <tr><td style="color:#7a8fa6">最低</td><td style="color:#ff4d6a;text-align:right">${low.toFixed(2)}</td></tr>
              <tr><td style="color:#7a8fa6">涨跌</td><td style="color:${c};text-align:right">${isUp ? '+' : ''}${pct}%</td></tr>
              <tr><td style="color:#7a8fa6">成交量</td><td style="color:#7a8fa6;text-align:right">${vol >= 10000 ? (vol / 10000).toFixed(0) + '万手' : vol + '手'}</td></tr>
              ${costRow}
              ${planRows ? '<tr><td colspan="2" style="padding-top:4px;border-top:0.5px solid #1e2d3d"></td></tr>' + planRows : ''}
            </table>
          </div>`
      },
    },

    series: [
      {
        name: 'K线',
        type: 'candlestick',
        xAxisIndex: 0, yAxisIndex: 0,
        data: data.ohlc_data,
        itemStyle: {
          color: '#00d97e', color0: '#ff4d6a',
          borderColor: '#00d97e', borderColor0: '#ff4d6a',
          borderWidth: 1,
        },
        markLine: allMarkLines.length > 0 ? {
          silent: false,
          symbol: ['none', 'none'],
          animation: false,
          data: allMarkLines,
        } : undefined,
        markArea: markAreaData.length > 0 ? {
          silent: true,
          data: markAreaData,
        } : undefined,
      },
      {
        name: 'MA5', type: 'line', xAxisIndex: 0, yAxisIndex: 0,
        data: ma5, smooth: true, symbol: 'none',
        lineStyle: { color: '#f5a623', width: 1 },
      },
      {
        name: 'MA10', type: 'line', xAxisIndex: 0, yAxisIndex: 0,
        data: ma10, smooth: true, symbol: 'none',
        lineStyle: { color: '#22d3ee', width: 1 },
      },
      {
        name: 'MA20', type: 'line', xAxisIndex: 0, yAxisIndex: 0,
        data: ma20, smooth: true, symbol: 'none',
        lineStyle: { color: '#a78bfa', width: 1 },
      },
      {
        name: '成交量',
        type: 'bar', xAxisIndex: 1, yAxisIndex: 1,
        data: data.volume_data,
        barMaxWidth: 8,
        itemStyle: {
          color: (params: any) =>
            (params.value as number[])[2] >= 0
              ? 'rgba(0,217,126,0.55)'
              : 'rgba(255,77,106,0.55)',
        },
      },
    ],
  } as echarts.EChartsOption
}

// ── 组件 ──────────────────────────────────────────────────────────
export default function KLineChart({ data, height, costPrice, buyPlans }: KLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const chart = echarts.init(containerRef.current, 'dark')
    chartRef.current = chart
    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(containerRef.current)
    return () => {
      ro.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!chartRef.current || !data) return
    chartRef.current.setOption(buildOption(data, costPrice, buyPlans), { notMerge: true })
  }, [data, costPrice, buyPlans])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: height != null ? height : '100%',
        minHeight: height != null ? height : 360,
      }}
    />
  )
}
