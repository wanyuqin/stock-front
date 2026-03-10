import { useRef, useEffect } from 'react'
import * as echarts from 'echarts'
import type { KLineResponse } from '@/types'

interface KLineChartProps {
  data: KLineResponse
  /** 固定高度（px）。不传则自动填满父容器高度 */
  height?: number
}

// ── 均线计算 ──────────────────────────────────────────────────────
function calcMA(period: number, data: [number, number, number, number][]): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null
    const sum = data
      .slice(i - period + 1, i + 1)
      .reduce((acc, d) => acc + d[1], 0) // d[1] = close
    return parseFloat((sum / period).toFixed(3))
  })
}

// ── 构建 ECharts option ───────────────────────────────────────────
function buildOption(data: KLineResponse): echarts.EChartsOption {
  const ma5  = calcMA(5,  data.ohlc_data)
  const ma10 = calcMA(10, data.ohlc_data)
  const ma20 = calcMA(20, data.ohlc_data)

  // 默认展示最近 60 根（dataZoom start）
  const defaultStart = Math.max(0, Math.round((1 - 60 / Math.max(data.dates.length, 1)) * 100))

  return {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 300,

    grid: [
      { left: 60, right: 12, top: 32, bottom: 90 },   // 主图
      { left: 60, right: 12, top: 'auto', bottom: 30, height: 56 }, // 量图
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
          formatter: (val: string) => val.slice(5), // 只显示 MM-DD
        },
        splitLine: { show: false },
        min: 'dataMin', max: 'dataMax',
      },
    ],

    yAxis: [
      {
        scale: true, gridIndex: 0, splitNumber: 4,
        axisLine:  { show: false }, axisTick: { show: false },
        axisLabel: {
          color: '#3d5166', fontSize: 10,
          fontFamily: 'JetBrains Mono, monospace',
          inside: false,
        },
        splitLine: { lineStyle: { color: '#1e2d3d', type: 'dashed' } },
        position: 'right',
      },
      {
        scale: true, gridIndex: 1, splitNumber: 2,
        axisLine:  { show: false }, axisTick: { show: false },
        axisLabel: {
          color: '#3d5166', fontSize: 9,
          fontFamily: 'JetBrains Mono, monospace',
          formatter: (val: number) =>
            val >= 10000 ? `${(val / 10000).toFixed(0)}万` : String(val),
        },
        splitLine: { show: false },
        position: 'right',
      },
    ],

    dataZoom: [
      {
        type: 'inside', xAxisIndex: [0, 1],
        start: defaultStart, end: 100,
      },
      {
        type: 'slider', xAxisIndex: [0, 1],
        bottom: 0, height: 20,
        start: defaultStart, end: 100,
        borderColor: '#1e2d3d',
        backgroundColor: '#0d1117',
        fillerColor: 'rgba(30,45,61,0.5)',
        handleStyle: { color: '#3d5166' },
        textStyle: { color: '#3d5166', fontSize: 10 },
        dataBackground: {
          lineStyle: { color: '#1e2d3d' },
          areaStyle: { color: '#131920' },
        },
        selectedDataBackground: {
          lineStyle: { color: '#3d5166' },
          areaStyle: { color: '#1c2a38' },
        },
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
        return `
          <div style="min-width:168px;line-height:1.6">
            <div style="color:#7a8fa6;font-size:11px;margin-bottom:5px">${kp.axisValue}</div>
            <table style="width:100%;font-size:12px;border-collapse:collapse">
              <tr><td style="color:#7a8fa6">开盘</td><td style="color:${c};text-align:right">${open.toFixed(2)}</td></tr>
              <tr><td style="color:#7a8fa6">收盘</td><td style="color:${c};text-align:right;font-weight:600">${close.toFixed(2)}</td></tr>
              <tr><td style="color:#7a8fa6">最高</td><td style="color:#00d97e;text-align:right">${high.toFixed(2)}</td></tr>
              <tr><td style="color:#7a8fa6">最低</td><td style="color:#ff4d6a;text-align:right">${low.toFixed(2)}</td></tr>
              <tr><td style="color:#7a8fa6">涨跌</td><td style="color:${c};text-align:right">${isUp ? '+' : ''}${pct}%</td></tr>
              <tr><td style="color:#7a8fa6">成交量</td><td style="color:#7a8fa6;text-align:right">${vol >= 10000 ? (vol / 10000).toFixed(0) + '万手' : vol + '手'}</td></tr>
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
          color:        '#00d97e',
          color0:       '#ff4d6a',
          borderColor:  '#00d97e',
          borderColor0: '#ff4d6a',
          borderWidth:  1,
        },
      },
      {
        name: 'MA5',
        type: 'line', xAxisIndex: 0, yAxisIndex: 0,
        data: ma5, smooth: true, symbol: 'none',
        lineStyle: { color: '#f5a623', width: 1 },
      },
      {
        name: 'MA10',
        type: 'line', xAxisIndex: 0, yAxisIndex: 0,
        data: ma10, smooth: true, symbol: 'none',
        lineStyle: { color: '#22d3ee', width: 1 },
      },
      {
        name: 'MA20',
        type: 'line', xAxisIndex: 0, yAxisIndex: 0,
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
export default function KLineChart({ data, height }: KLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<echarts.ECharts | null>(null)

  // 初始化 / 销毁
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

  // 数据更新
  useEffect(() => {
    if (!chartRef.current || !data) return
    chartRef.current.setOption(buildOption(data), { notMerge: true })
  }, [data])

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
