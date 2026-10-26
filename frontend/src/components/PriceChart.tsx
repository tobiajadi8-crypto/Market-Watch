import { useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../api'
import { useFetch } from '../hooks/useFetch'
import { formatPercent, formatPrice } from '../lib/format'
import type { Analysis, Range } from '../types'
import { RANGE_LABEL } from '../lib/ranges'
import { RangeTabs } from './RangeTabs'

interface Props {
  symbol: string
  currency: string
  range: Range
  onRangeChange: (range: Range) => void
  /** Analysis for the same symbol; overlays only draw when its range matches the chart's. */
  analysis: Analysis | null
}

type Overlay = 'ma20' | 'ma50' | 'forecast'

const OVERLAYS: { key: Overlay; label: string; className: string }[] = [
  { key: 'ma20', label: '20-day MA', className: 'swatch-ma20' },
  { key: 'ma50', label: '50-day MA', className: 'swatch-ma50' },
  { key: 'forecast', label: 'Forecast', className: 'swatch-forecast' },
]

const STORAGE_KEY = 'market-watch:overlays'

function loadOverlays(): Record<Overlay, boolean> {
  const defaults = { ma20: true, ma50: true, forecast: true }
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  } catch {
    return defaults
  }
}

interface Row {
  time: number
  close?: number
  ma20?: number | null
  ma50?: number | null
  forecast?: number
}

function dayKey(time: number): number {
  const d = new Date(time)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

function formatTick(time: number, range: Range): string {
  const d = new Date(time)
  if (range === '1d') return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (range === '5d') return d.toLocaleDateString('en-US', { weekday: 'short' })
  if (range === '5y') return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTooltipTime(time: number, range: Range): string {
  const d = new Date(time)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return range === '1d' || range === '5d'
    ? `${date}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : date
}

interface TooltipProps {
  active?: boolean
  label?: number | string
  payload?: { payload: Row }[]
  range: Range
  currency: string
}

function ChartTooltip({ active, payload, label, range, currency }: TooltipProps) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  const items: [string, string, number | null | undefined][] = [
    ['Close', 'swatch-close', row.close],
    ['20-day MA', 'swatch-ma20', row.ma20],
    ['50-day MA', 'swatch-ma50', row.ma50],
    // The last real close also starts the forecast line; only show "Forecast" on projected days.
    ['Forecast', 'swatch-forecast', row.close == null ? row.forecast : null],
  ]
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{formatTooltipTime(Number(label), range)}</div>
      {items
        .filter(([, , v]) => v != null)
        .map(([name, swatch, v]) => (
          <div key={name} className="chart-tooltip-row">
            <span className={`swatch ${swatch}`} aria-hidden="true" />
            <span className="muted">{name}</span>
            <span className="chart-tooltip-value">{formatPrice(v, currency)}</span>
          </div>
        ))}
    </div>
  )
}

export function PriceChart({ symbol, currency, range, onRangeChange, analysis }: Props) {
  const [shown, setShown] = useState(loadOverlays)

  // Refresh the intraday chart every minute; longer ranges don't need it.
  const { data, error, loading } = useFetch(
    () => api.history(symbol, range),
    [symbol, range],
    range === '1d' ? 60_000 : undefined,
  )
  const points = data?.symbol === symbol && data.range === range ? data.points : []

  const first = points[0]?.close
  const last = points.at(-1)?.close
  const periodChange = first && last ? ((last - first) / first) * 100 : null
  const up = (periodChange ?? 0) >= 0
  const color = up ? 'var(--up)' : 'var(--down)'

  const overlaysReady = analysis != null && analysis.symbol === symbol && analysis.range === range
  const dailyRange = range === '1mo' || range === '6mo' || range === '1y'
  const on = (key: Overlay) => overlaysReady && shown[key]

  function toggle(key: Overlay) {
    const next = { ...shown, [key]: !shown[key] }
    setShown(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Storage can be unavailable (private mode); the toggle still works for this visit.
    }
  }

  // Merge moving averages onto the price candles by calendar day, then append forecast days.
  const rows: Row[] = points.map((p) => ({ time: p.time, close: p.close }))
  if (overlaysReady) {
    const byDay = new Map(analysis.points.map((p) => [dayKey(p.time), p]))
    for (const row of rows) {
      const a = byDay.get(dayKey(row.time))
      row.ma20 = a?.ma20 ?? null
      row.ma50 = a?.ma50 ?? null
    }
    if (shown.forecast && rows.length) {
      rows[rows.length - 1].forecast = rows[rows.length - 1].close
      for (const f of analysis.forecast.points) rows.push({ time: f.time, forecast: f.close })
    }
  }
  const lastActualTime = points.at(-1)?.time
  const lastForecastTime = on('forecast') ? analysis?.forecast.points.at(-1)?.time : undefined

  return (
    <section className="card">
      <div className="chart-toolbar">
        <div>
          <h2>Price</h2>
          {periodChange != null && (
            <span className={`small ${up ? 'up' : 'down'}`}>
              {formatPercent(periodChange)} over {RANGE_LABEL[range]}
            </span>
          )}
        </div>
        <RangeTabs value={range} onChange={onRangeChange} label="Chart range" />
      </div>

      <div className="legend" aria-label="Chart series">
        <span className="legend-item static">
          <span className="swatch swatch-close" style={{ background: color }} aria-hidden="true" />
          Close
        </span>
        {OVERLAYS.map((o) => (
          <button
            key={o.key}
            className="legend-item"
            aria-pressed={on(o.key)}
            disabled={!overlaysReady}
            onClick={() => toggle(o.key)}
            title={overlaysReady ? `Show or hide the ${o.label.toLowerCase()}` : undefined}
          >
            <span className={`swatch ${o.className}`} aria-hidden="true" />
            {o.label}
          </button>
        ))}
        {!dailyRange && <span className="muted small">Indicators use daily closes. Switch to 1M, 6M or 1Y to see them.</span>}
      </div>

      <div className="chart-body">
        {error && <div className="chart-msg down">{error}</div>}
        {!error && loading && points.length === 0 && <div className="chart-msg muted">Loading chart…</div>}
        {!error && !loading && points.length === 0 && <div className="chart-msg muted">No data for this range.</div>}
        {points.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis
                dataKey="time"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(t: number) => formatTick(t, range)}
                tick={{ fill: 'var(--muted)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                domain={['auto', 'auto']}
                orientation="right"
                tickFormatter={(v: number) => v.toFixed(v < 10 ? 2 : 0)}
                tick={{ fill: 'var(--muted)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              {lastActualTime != null && lastForecastTime != null && (
                <ReferenceArea
                  x1={lastActualTime}
                  x2={lastForecastTime}
                  fill="var(--text)"
                  fillOpacity={0.05}
                  strokeOpacity={0}
                  label={{ value: 'Forecast', position: 'insideTop', fill: 'var(--muted)', fontSize: 12 }}
                />
              )}
              {first != null && <ReferenceLine y={first} stroke="var(--muted)" strokeDasharray="3 3" strokeOpacity={0.5} />}
              <Tooltip
                content={<ChartTooltip range={range} currency={currency} />}
                cursor={{ stroke: 'var(--muted)', strokeOpacity: 0.6 }}
              />
              <Area
                type="monotone"
                dataKey="close"
                name="Close"
                stroke={color}
                strokeWidth={2}
                fill="url(#priceFill)"
                isAnimationActive={false}
              />
              {on('ma50') && (
                <Line
                  type="monotone"
                  dataKey="ma50"
                  name="50-day MA"
                  stroke="var(--ma50)"
                  strokeWidth={2}
                  strokeDasharray="10 5"
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              )}
              {on('ma20') && (
                <Line
                  type="monotone"
                  dataKey="ma20"
                  name="20-day MA"
                  stroke="var(--ma20)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              )}
              {on('forecast') && (
                <Line
                  type="linear"
                  dataKey="forecast"
                  name="Forecast"
                  stroke="var(--forecast)"
                  strokeWidth={2}
                  strokeDasharray="2 4"
                  // Mark only the final projected day; a dot on every day crowds long ranges.
                  dot={(props: { index?: number; cx?: number; cy?: number }) =>
                    props.index === rows.length - 1 && props.cx != null && props.cy != null ? (
                      <circle
                        key="forecast-end"
                        cx={props.cx}
                        cy={props.cy}
                        r={4}
                        fill="var(--forecast)"
                        stroke="var(--surface)"
                        strokeWidth={2}
                      />
                    ) : (
                      <g key={`f-${props.index}`} />
                    )
                  }
                  activeDot={{ r: 5, fill: 'var(--forecast)', stroke: 'var(--surface)', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}
