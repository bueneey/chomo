import { useEffect, useRef } from 'react'
import {
  AreaSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { ChartPoint } from '../types'

function chartKey(points: ChartPoint[]): string {
  if (!points.length) return '0'
  const last = points[points.length - 1]!
  return `${points.length}:${last.timestamp}:${last.pnlUsd.toFixed(4)}`
}

export function PnlChart({ points }: { points: ChartPoint[] }) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null)
  const lastKey = useRef('')

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9aa1b2',
        fontFamily: 'Outfit, sans-serif',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: 'rgba(255,255,255,0.18)' },
        horzLine: { color: 'rgba(255,255,255,0.18)' },
      },
    })

    const series = chart.addSeries(AreaSeries, {
      lineColor: '#3dff8a',
      topColor: 'rgba(61,255,138,0.22)',
      bottomColor: 'rgba(0,0,0,0)',
      lineWidth: 2,
      priceLineVisible: false,
    })

    chartRef.current = chart
    seriesRef.current = series

    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      lastKey.current = ''
    }
  }, [])

  useEffect(() => {
    const series = seriesRef.current
    const chart = chartRef.current
    if (!series || !chart) return

    const key = chartKey(points)
    if (key === lastKey.current) return
    lastKey.current = key

    if (points.length < 2) {
      series.setData([])
      return
    }

    const up = (points[points.length - 1]?.pnlUsd ?? 0) >= 0
    series.applyOptions({
      lineColor: up ? '#3dff8a' : '#ff5c6a',
      topColor: up ? 'rgba(61,255,138,0.22)' : 'rgba(255,92,106,0.22)',
    })

    const dedup: Array<{ time: UTCTimestamp; value: number }> = []
    for (const p of points) {
      const row = {
        time: Math.floor(p.timestamp / 1000) as UTCTimestamp,
        value: p.pnlUsd,
      }
      const prev = dedup[dedup.length - 1]
      if (prev && prev.time === row.time) prev.value = row.value
      else dedup.push(row)
    }

    series.setData(dedup)
    chart.timeScale().fitContent()
  }, [points])

  return (
    <div className="chart-wrap" ref={wrapRef}>
      {points.length < 2 ? <div className="empty">not enough history yet</div> : null}
    </div>
  )
}
