import { useEffect, useMemo, useRef, useState } from 'react'
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

export type ChartRange = '1d' | '7d' | '30d' | 'all'

const RANGES: Array<{ id: ChartRange; label: string }> = [
  { id: '1d', label: '1d' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: 'all', label: 'all' },
]

const RANGE_MS: Record<ChartRange, number> = {
  '1d': 86_400_000,
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
  all: Number.POSITIVE_INFINITY,
}

function pointValue(p: ChartPoint): number {
  return p.balanceUsd ?? p.equityUsd ?? p.pnlUsd ?? 0
}

function filterByRange(points: ChartPoint[], range: ChartRange): ChartPoint[] {
  if (range === 'all' || points.length < 2) return points
  const cutoff = Date.now() - RANGE_MS[range]
  const inRange = points.filter((p) => p.timestamp >= cutoff)
  if (inRange.length >= 2) return inRange
  const before = points.filter((p) => p.timestamp < cutoff)
  const anchor = before[before.length - 1]
  if (anchor && inRange.length) return [anchor, ...inRange]
  if (anchor) return [anchor, points[points.length - 1]!]
  return points.slice(-2)
}

function chartKey(points: ChartPoint[], range: ChartRange): string {
  if (!points.length) return `${range}:0`
  const last = points[points.length - 1]!
  return `${range}:${points.length}:${last.timestamp}:${pointValue(last).toFixed(4)}`
}

function formatHoverBalance(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1000) return `$${(abs / 1000).toFixed(1)}K`
  return `$${abs.toFixed(2)}`
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

type Tip = { value: number; timeLabel: string; x: number; y: number }

export function PnlChart({
  points,
  range,
  onRangeChange,
}: {
  points: ChartPoint[]
  range: ChartRange
  onRangeChange: (range: ChartRange) => void
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null)
  const lastKey = useRef('')
  const pointMap = useRef(new Map<number, number>())
  const [tip, setTip] = useState<Tip | null>(null)

  const filtered = useMemo(() => filterByRange(points, range), [points, range])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const chart = createChart(el, {
      autoSize: true,
      handleScroll: false,
      handleScale: false,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8b93a7',
        fontFamily: 'Syne, Outfit, sans-serif',
        fontSize: 11,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: 'rgba(255,255,255,0.05)' },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.18, bottom: 0.1 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: 'rgba(255,255,255,0.4)',
          style: 3,
          width: 1,
          labelVisible: false,
        },
        horzLine: { visible: false, labelVisible: false },
      },
    })

    const series = chart.addSeries(AreaSeries, {
      lineColor: '#7cffb2',
      topColor: 'rgba(124,255,178,0.2)',
      bottomColor: 'rgba(0,0,0,0)',
      lineWidth: 2,
      priceLineVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: '#fff',
      crosshairMarkerBackgroundColor: '#7cffb2',
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
      setTip({
        value,
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

    const key = chartKey(filtered, range)
    if (key === lastKey.current) return
    lastKey.current = key

    if (filtered.length < 2) {
      series.setData([])
      pointMap.current.clear()
      return
    }

    const dedup: Array<{ time: UTCTimestamp; value: number }> = []
    const map = new Map<number, number>()
    for (const p of filtered) {
      const time = Math.floor(p.timestamp / 1000)
      const value = pointValue(p)
      const row = { time: time as UTCTimestamp, value }
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
  }, [filtered, range])

  return (
    <div className="chart-shell">
      <div className="range-tabs" role="tablist" aria-label="Balance range">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={range === r.id}
            className={`range-tab${range === r.id ? ' active' : ''}`}
            onClick={() => onRangeChange(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="chart-wrap" ref={wrapRef}>
        {filtered.length < 2 ? <div className="empty">not enough history for this range</div> : null}
        {tip ? (
          <div className="chart-tip up" style={{ left: tip.x, top: tip.y }}>
            <strong>{formatHoverBalance(tip.value)}</strong>
            <span>{tip.timeLabel}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
