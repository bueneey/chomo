import { useEffect, useRef, useState } from 'react'
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { ChartPoint } from '../types'

function chartKey(points: ChartPoint[]): string {
  if (!points.length) return '0'
  const last = points[points.length - 1]!
  return `${points.length}:${last.timestamp}:${last.pnlUsd.toFixed(4)}`
}

function formatHoverPnl(n: number): string {
  const abs = Math.abs(n)
  const sign = n > 0 ? '+' : n < 0 ? '-' : ''
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(2)}`
}

function formatHoverTime(tsMs: number): string {
  return new Date(tsMs).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

type Tip = { pnl: number; timeLabel: string; x: number; y: number }

export function PnlChart({ points }: { points: ChartPoint[] }) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null)
  const lastKey = useRef('')
  const pointMap = useRef(new Map<number, number>())
  const [tip, setTip] = useState<Tip | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const chart = createChart(el, {
      autoSize: true,
      handleScroll: false,
      handleScale: false,
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
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        scaleMargins: { top: 0.15, bottom: 0.12 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: 'rgba(255,255,255,0.45)',
          style: 3,
          width: 1,
          labelVisible: false,
        },
        horzLine: {
          visible: false,
          labelVisible: false,
        },
      },
    })

    const series = chart.addSeries(AreaSeries, {
      lineColor: '#3dff8a',
      topColor: 'rgba(61,255,138,0.22)',
      bottomColor: 'rgba(0,0,0,0)',
      lineWidth: 2,
      priceLineVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: '#fff',
      crosshairMarkerBackgroundColor: '#3dff8a',
    })

    chartRef.current = chart
    seriesRef.current = series

    const onMove = (param: MouseEventParams) => {
      if (!param.point || param.time === undefined) {
        setTip(null)
        return
      }
      const t = param.time as number
      const value = pointMap.current.get(t)
      if (value === undefined) {
        setTip(null)
        return
      }
      const up = value >= 0
      series.applyOptions({
        crosshairMarkerBackgroundColor: up ? '#3dff8a' : '#ff5c6a',
      })
      setTip({
        pnl: value,
        timeLabel: formatHoverTime(t * 1000),
        x: Math.min(Math.max(param.point.x, 12), el.clientWidth - 160),
        y: Math.max(param.point.y - 58, 8),
      })
    }

    chart.subscribeCrosshairMove(onMove)

    return () => {
      chart.unsubscribeCrosshairMove(onMove)
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      lastKey.current = ''
      setTip(null)
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
      pointMap.current.clear()
      return
    }

    const up = (points[points.length - 1]?.pnlUsd ?? 0) >= 0
    series.applyOptions({
      lineColor: up ? '#3dff8a' : '#ff5c6a',
      topColor: up ? 'rgba(61,255,138,0.22)' : 'rgba(255,92,106,0.22)',
      crosshairMarkerBackgroundColor: up ? '#3dff8a' : '#ff5c6a',
    })

    const dedup: Array<{ time: UTCTimestamp; value: number }> = []
    const map = new Map<number, number>()
    for (const p of points) {
      const time = Math.floor(p.timestamp / 1000)
      const row = { time: time as UTCTimestamp, value: p.pnlUsd }
      const prev = dedup[dedup.length - 1]
      if (prev && prev.time === row.time) {
        prev.value = row.value
        map.set(time, row.value)
      } else {
        dedup.push(row)
        map.set(time, row.value)
      }
    }
    pointMap.current = map
    series.setData(dedup)
    chart.timeScale().fitContent()
  }, [points])

  return (
    <div className="chart-wrap" ref={wrapRef}>
      {points.length < 2 ? <div className="empty">not enough history yet</div> : null}
      {tip ? (
        <div
          className={`chart-tip ${tip.pnl >= 0 ? 'up' : 'down'}`}
          style={{ left: tip.x, top: tip.y }}
        >
          <strong>{formatHoverPnl(tip.pnl)}</strong>
          <span>{tip.timeLabel}</span>
        </div>
      ) : null}
    </div>
  )
}
