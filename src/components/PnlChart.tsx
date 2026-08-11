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

export function PnlChart({ points }: { points: ChartPoint[] }) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null)

  const polarity = points.length > 1 ? Math.sign(points[points.length - 1]?.pnlUsd ?? 0) : 0

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#5a6358',
        fontFamily: 'IBM Plex Sans, sans-serif',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(20, 24, 20, 0.06)' },
        horzLines: { color: 'rgba(20, 24, 20, 0.06)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(20, 24, 20, 0.12)',
      },
      timeScale: {
        borderColor: 'rgba(20, 24, 20, 0.12)',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: 'rgba(26, 33, 84, 0.25)' },
        horzLine: { color: 'rgba(26, 33, 84, 0.25)' },
      },
    })

    const up = polarity >= 0
    const series = chart.addSeries(AreaSeries, {
      lineColor: up ? '#3d6b3d' : '#a84848',
      topColor: up ? 'rgba(61,107,61,0.22)' : 'rgba(168,72,72,0.22)',
      bottomColor: 'rgba(255,255,255,0)',
      lineWidth: 2,
      priceLineVisible: false,
    })

    chartRef.current = chart
    seriesRef.current = series

    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [polarity])

  useEffect(() => {
    const series = seriesRef.current
    const chart = chartRef.current
    if (!series || !chart) return

    if (points.length < 2) {
      series.setData([])
      return
    }

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
