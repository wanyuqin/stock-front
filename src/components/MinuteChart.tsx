import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import type { MinuteResponse, BigDealSummary } from '@/types'

interface MinuteChartProps {
  data: MinuteResponse
  bigDealData?: BigDealSummary | null   // 特大单打点 + 成本线
  height?: number
}

export default function MinuteChart({ data, bigDealData, height }: MinuteChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return
    const chart = echarts.init(chartRef.current, 'dark')
    instanceRef.current = chart

    const bars = data.bars
    if (!bars || bars.length === 0) return

    const times     = bars.map(b => b.time)
    const prices    = bars.map(b => b.price)
    const avgPrices = bars.map(b => b.avg_price)

    const preClose = data.pre_close
    const mainAvgCost = bigDealData?.main_avg_cost ?? 0

    // 价格范围：同时考虑成本线
    const allPrices = [...prices, preClose]
    if (mainAvgCost > 0) allPrices.push(mainAvgCost)
    const minPrice = Math.min(...allPrices) * 0.995
    const maxPrice = Math.max(...allPrices) * 1.005

    // ── 特大单 markPoint 数据 ─────────────────────────────────────
    // tick.time 格式 "09:30" 与 bars[i].time 对应
    const superTicks = (bigDealData?.ticks ?? []).filter(t => t.size === 'super')

    // 建立 time → index 映射（精确查找）
    const timeToIdx = new Map<string, number>()
    times.forEach((t, i) => timeToIdx.set(t, i))

    // tick.time 可能是 "093012"（HHMMSS），转为 HH:MM
    function tickTimeToChartTime(t: string): string {
      if (t.length === 6) return `${t.slice(0, 2)}:${t.slice(2, 4)}`
      if (t.length === 5 && t.includes(':')) return t
      if (t.length === 4) return `${t.slice(0, 2)}:${t.slice(2, 4)}`
      return t
    }

    const markPoints = superTicks.map(tick => {
      const chartTime = tickTimeToChartTime(tick.time)
      const idx = timeToIdx.get(chartTime) ?? -1
      if (idx < 0) return null
      const bar = bars[idx]
      const isBuy = tick.direction === 'B'
      return {
        coord: [idx, bar.price],
        value: (tick.amount / 10000).toFixed(0) + '万',
        itemStyle: { color: isBuy ? '#f97316' : '#818cf8' },
        symbol: isBuy ? 'triangle' : 'pin',
        symbolSize: isBuy ? 10 : 12,
        symbolRotate: isBuy ? 0 : 180,
        label: {
          show: true,
          formatter: isBuy ? '▲' : '▼',
          color: isBuy ? '#f97316' : '#818cf8',
          fontSize: 9,
          offset: isBuy ? [0, -14] : [0, 14],
        },
      }
    }).filter(Boolean)

    // ── 成本线 markLine 数据 ──────────────────────────────────────
    const baseMarkLines: any[] = [
      {
        yAxis: preClose,
        lineStyle: { color: '#555', type: 'dashed', width: 1 },
        label: {
          show: true,
          position: 'end',
          formatter: `昨收 ${preClose.toFixed(2)}`,
          color: '#666',
          fontSize: 9,
          fontFamily: 'monospace',
        },
      },
    ]

    if (mainAvgCost > 0) {
      baseMarkLines.push({
        yAxis: mainAvgCost,
        lineStyle: { color: '#f97316', type: 'dashed', width: 1.5 },
        label: {
          show: true,
          position: 'end',
          formatter: `主力均价 ${mainAvgCost.toFixed(2)}`,
          color: '#f97316',
          fontSize: 9,
          fontFamily: 'monospace',
          backgroundColor: 'rgba(249,115,22,0.12)',
          borderRadius: 2,
          padding: [1, 4],
        },
      })
    }

    // ── ECharts option ────────────────────────────────────────────
    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      animation: false,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', lineStyle: { color: '#555' } },
        backgroundColor: 'rgba(18,18,24,0.92)',
        borderColor: '#333',
        textStyle: { color: '#ccc', fontSize: 11, fontFamily: 'monospace' },
        formatter(params: any) {
          const idx = params[0]?.dataIndex ?? 0
          const bar = bars[idx]
          if (!bar) return ''
          const pct = ((bar.price - preClose) / preClose * 100).toFixed(2)
          const sign = Number(pct) >= 0 ? '+' : ''
          const amtWan = (bar.cum_amount / 1e8).toFixed(2)

          // 该时刻有没有特大单
          const chartTime = bar.time
          const ticksAtTime = superTicks.filter(t => tickTimeToChartTime(t.time) === chartTime)
          const tickHtml = ticksAtTime.map(t => {
            const isBuy = t.direction === 'B'
            const amtStr = (t.amount / 10000).toFixed(0) + '万'
            return `<div style="color:${isBuy ? '#f97316' : '#818cf8'}">` +
              `${isBuy ? '▲特大买' : '▼特大卖'} ${amtStr}</div>`
          }).join('')

          return [
            `<div style="margin-bottom:4px;color:#888">${bar.time}</div>`,
            `<div>价格 <span style="color:${Number(pct) >= 0 ? '#ef5350' : '#26a69a'};font-weight:600">${bar.price.toFixed(2)}</span>`,
            ` <span style="color:#888;font-size:10px">${sign}${pct}%</span></div>`,
            `<div>均价 <span style="color:#fbbf24">${bar.avg_price.toFixed(2)}</span></div>`,
            mainAvgCost > 0
              ? `<div>主力均价 <span style="color:#f97316">${mainAvgCost.toFixed(2)}</span></div>`
              : '',
            `<div>量  <span style="color:#64b5f6">${(bar.volume / 100).toFixed(0)}手</span></div>`,
            `<div>额  <span style="color:#888">${amtWan}亿</span></div>`,
            tickHtml,
          ].join('')
        },
      },
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      grid: [
        { left: 64, right: mainAvgCost > 0 ? 80 : 12, top: 12, bottom: 80 },
        { left: 64, right: mainAvgCost > 0 ? 80 : 12, top: '72%', bottom: 24 },
      ],
      xAxis: [
        {
          gridIndex: 0,
          type: 'category',
          data: times,
          boundaryGap: false,
          axisLine: { lineStyle: { color: '#333' } },
          axisTick: { show: false },
          axisLabel: {
            color: '#555',
            fontSize: 9,
            fontFamily: 'monospace',
            interval(idx: number) {
              return times[idx]?.endsWith(':00') || times[idx]?.endsWith(':30') || idx === 0
            },
          },
          splitLine: { show: false },
        },
        {
          gridIndex: 1,
          type: 'category',
          data: times,
          boundaryGap: false,
          axisLabel: { show: false },
          axisTick: { show: false },
          axisLine: { lineStyle: { color: '#333' } },
          splitLine: { show: false },
        },
      ],
      yAxis: [
        {
          gridIndex: 0,
          min: minPrice,
          max: maxPrice,
          scale: true,
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: '#1e1e2a', type: 'dashed' } },
          axisLabel: {
            color: '#555',
            fontSize: 9,
            fontFamily: 'monospace',
            formatter(v: number) { return v.toFixed(2) },
          },
          splitNumber: 5,
        },
        {
          gridIndex: 1,
          axisLabel: { show: false },
          axisTick: { show: false },
          axisLine: { show: false },
          splitLine: { show: false },
        },
      ],
      series: [
        // 价格折线
        {
          name: '价格',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: prices,
          smooth: false,
          symbol: 'none',
          lineStyle: { color: '#5470c6', width: 1.5 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(84,112,198,0.25)' },
              { offset: 1, color: 'rgba(84,112,198,0.02)' },
            ]),
          },
          // markLine：昨收 + 主力均价
          markLine: {
            silent: true,
            symbol: 'none',
            data: baseMarkLines,
          },
          // markPoint：特大单打点
          markPoint: markPoints.length > 0 ? {
            data: markPoints as any,
            tooltip: { show: false }, // tooltip 已在 axis 统一展示
          } : undefined,
        },
        // 均价折线
        {
          name: '均价',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: avgPrices,
          smooth: false,
          symbol: 'none',
          lineStyle: { color: '#fbbf24', width: 1, type: 'dashed' },
        },
        // 成交量
        {
          name: '成交量',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: bars.map((b, i) => {
            const prev = i > 0 ? bars[i - 1].price : preClose
            const isUp = b.price >= prev
            // 有特大单的柱子加亮
            const chartTime = b.time
            const hasSuperTick = superTicks.some(t => tickTimeToChartTime(t.time) === chartTime)
            return {
              value: b.volume,
              itemStyle: {
                color: hasSuperTick
                  ? (isUp ? 'rgba(249,115,22,0.9)' : 'rgba(129,140,248,0.9)')
                  : (isUp ? 'rgba(239,83,80,0.65)' : 'rgba(38,166,154,0.65)'),
                borderWidth: hasSuperTick ? 1 : 0,
                borderColor: hasSuperTick ? (isUp ? '#f97316' : '#818cf8') : 'transparent',
              },
            }
          }),
          barCategoryGap: '10%',
        },
      ],
    }

    chart.setOption(option)

    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(chartRef.current!)
    return () => {
      ro.disconnect()
      chart.dispose()
    }
  }, [data, bigDealData])

  return (
    <div
      ref={chartRef}
      style={{ width: '100%', height: height ?? '100%', minHeight: 280 }}
    />
  )
}
