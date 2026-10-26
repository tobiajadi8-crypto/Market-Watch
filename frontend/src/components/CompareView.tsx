import { useEffect, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api'
import { useFetch } from '../hooks/useFetch'
import { formatPercent, formatPrice, trendClass } from '../lib/format'
import type { Comparison, Range } from '../types'
import { RANGE_LABEL } from '../lib/ranges'
import { RangeTabs } from './RangeTabs'
import { SearchBar } from './SearchBar'

export const MAX_COMPARE = 6
const SLOTS = MAX_COMPARE

interface Props {
  symbols: string[]
  watchlist: string[]
  onChange: (symbols: string[]) => void
  onOpen: (symbol: string) => void
}

/** Gives each new symbol the lowest free color slot, keeping existing symbols' slots. */
function assignSlots(prev: Map<string, number>, symbols: string[]): Map<string, number> {
  const next = new Map([...prev].filter(([s]) => symbols.includes(s)))
  for (const s of symbols) {
    if (next.has(s)) continue
    const used = new Set(next.values())
    let slot = 0
    while (used.has(slot) && slot < SLOTS - 1) slot++
    next.set(s, slot)
  }
  return next
}

/**
 * Keeps each symbol's color stable: adding or removing one symbol never repaints the others.
 * Uses React's "adjust state while rendering" pattern, so no effect or ref is needed.
 */
function useStableSlots(symbols: string[]): Map<string, number> {
  const key = symbols.join(',')
  const [state, setState] = useState(() => ({ key, slots: assignSlots(new Map(), symbols) }))
  if (state.key !== key) {
    const next = { key, slots: assignSlots(state.slots, symbols) }
    setState(next)
    return next.slots
  }
  return state.slots
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

/** A round step for the y-axis so the domain (and pixel mapping for end labels) is predictable. */
function niceStep(span: number): number {
  const raw = span / 5
  const pow = 10 ** Math.floor(Math.log10(raw || 1))
  const n = raw / pow
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow
}

const MARGIN = { top: 12, right: 118, bottom: 0, left: 0 }
const X_AXIS_HEIGHT = 30
const LABEL_GAP_PX = 16

interface TooltipProps {
  active?: boolean
  label?: number | string
  payload?: { name?: string; value?: number; color?: string }[]
  range: Range
}

function CompareTooltip({ active, payload, label, range }: TooltipProps) {
  if (!active || !payload?.length) return null
  const items = payload.filter((p) => p.value != null).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{formatTooltipTime(Number(label), range)}</div>
      {items.map((p) => (
        <div key={p.name} className="chart-tooltip-row">
          <span className="swatch" style={{ background: p.color }} aria-hidden="true" />
          <span>{p.name}</span>
          <span className="chart-tooltip-value">{formatPercent(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function CompareChart({ data, range, slots }: { data: Comparison; range: Range; slots: Map<string, number> }) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(360)

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeight(el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const symbols = data.series.map((s) => s.symbol)
  const values = data.points.flatMap((row) => symbols.map((s) => row[s]).filter((v) => v != null))
  const lo0 = Math.min(0, ...values)
  const hi0 = Math.max(0, ...values)
  const step = niceStep(hi0 - lo0)
  const lo = Math.floor(lo0 / step) * step
  const hi = Math.ceil(hi0 / step) * step || step

  // Direct end labels, nudged apart so lines that finish close together stay readable.
  const plotHeight = Math.max(1, height - MARGIN.top - MARGIN.bottom - X_AXIS_HEIGHT)
  const pxPerUnit = plotHeight / (hi - lo)
  const ends = data.series
    .map((s) => ({ symbol: s.symbol, value: s.changePercent }))
    .sort((a, b) => b.value - a.value)
  const labelY = new Map<string, number>()
  let prevPx = -Infinity
  for (const e of ends) {
    const px = Math.max((hi - e.value) * pxPerUnit, prevPx + LABEL_GAP_PX)
    labelY.set(e.symbol, px)
    prevPx = px
  }
  // If the stack ran off the bottom, shift everything back up.
  const overflow = prevPx - plotHeight
  if (overflow > 0) for (const [k, v] of labelY) labelY.set(k, v - overflow)

  const lastIndex = new Map(
    symbols.map((s) => {
      for (let i = data.points.length - 1; i >= 0; i--) if (data.points[i][s] != null) return [s, i]
      return [s, -1]
    }),
  )

  return (
    <div className="chart-body compare-body" ref={bodyRef}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.points} margin={MARGIN}>
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
            height={X_AXIS_HEIGHT}
          />
          <YAxis
            domain={[lo, hi]}
            ticks={Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step)}
            tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${Number(v.toFixed(2))}%`}
            tick={{ fill: 'var(--muted)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <ReferenceLine y={0} stroke="var(--muted)" strokeOpacity={0.8} />
          <Tooltip content={<CompareTooltip range={range} />} cursor={{ stroke: 'var(--muted)', strokeOpacity: 0.6 }} />
          {data.series.map((s) => {
            const slot = slots.get(s.symbol) ?? 0
            return (
              <Line
                key={s.symbol}
                // Function accessor: symbols like "BRK.B" would otherwise be read as a nested path.
                dataKey={(row: Record<string, number>) => row[s.symbol]}
                name={s.symbol}
                stroke={`var(--series-${slot + 1})`}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }}
                connectNulls
                isAnimationActive={false}
                label={(props: { index?: number; x?: number | string; y?: number | string }) => {
                  if (props.index !== lastIndex.get(s.symbol) || props.x == null) return <g key="none" />
                  const y = MARGIN.top + (labelY.get(s.symbol) ?? 0)
                  return (
                    <g key={`end-${s.symbol}`}>
                      <text x={Number(props.x) + 10} y={y} dy="0.35em" className="end-label">
                        <tspan fontWeight={600}>{s.symbol}</tspan>
                        <tspan dx={6} className="end-label-value">
                          {formatPercent(s.changePercent)}
                        </tspan>
                      </text>
                    </g>
                  )
                }}
              />
            )
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function CompareView({ symbols, watchlist, onChange, onOpen }: Props) {
  const [range, setRange] = useState<Range>('6mo')
  const slots = useStableSlots(symbols)
  const key = symbols.join(',')
  const { data, error, loading } = useFetch(
    () => (symbols.length ? api.compare(symbols, range) : Promise.resolve(null)),
    [key, range],
  )
  const current = data && data.range === range ? data : null
  const full = symbols.length >= MAX_COMPARE

  const add = (s: string) => {
    const sym = s.toUpperCase()
    if (!symbols.includes(sym) && !full) onChange([...symbols, sym])
  }
  const remove = (s: string) => onChange(symbols.filter((x) => x !== s))
  const suggestions = watchlist.filter((s) => !symbols.includes(s)).slice(0, 8)
  const ranked = current ? [...current.series].sort((a, b) => b.changePercent - a.changePercent) : []

  return (
    <>
      <section className="card">
        <div className="chart-toolbar">
          <div>
            <h1 className="view-title">Compare</h1>
            <span className="muted small">
              Performance as % change since the start of the range. Up to {MAX_COMPARE} symbols.
            </span>
          </div>
          <RangeTabs value={range} onChange={setRange} label="Comparison range" />
        </div>

        <div className="compare-controls">
          <ul className="compare-chips" aria-label="Symbols being compared">
            {symbols.map((s) => (
              <li key={s} className="compare-chip">
                <span className="swatch" style={{ background: `var(--series-${(slots.get(s) ?? 0) + 1})` }} aria-hidden="true" />
                <button className="chip-label" onClick={() => onOpen(s)} title={`Open ${s}`}>
                  {s}
                </button>
                <button className="chip-remove" onClick={() => remove(s)} aria-label={`Remove ${s}`}>
                  ×
                </button>
              </li>
            ))}
          </ul>
          {!full && <SearchBar onSelect={add} placeholder="Add a symbol to compare…" className="compare-search" />}
        </div>

        {suggestions.length > 0 && !full && (
          <div className="suggestions small">
            <span className="muted">From your watchlist:</span>
            {suggestions.map((s) => (
              <button key={s} className="tag link" onClick={() => add(s)}>
                + {s}
              </button>
            ))}
          </div>
        )}

        {symbols.length < 2 && (
          <p className="muted small">Add at least 2 symbols to see how they stack up against each other.</p>
        )}

        {error && <div className="chart-msg-inline down">{error}</div>}
        {current?.errors.map((e) => (
          <p key={e.symbol} className="muted small">
            Couldn't load {e.symbol}: {e.error}
          </p>
        ))}

        {symbols.length > 0 && !current && !error && loading && (
          <div className="chart-body">
            <div className="chart-msg muted">Loading comparison…</div>
          </div>
        )}
        {current && current.points.length > 0 && <CompareChart data={current} range={range} slots={slots} />}
      </section>

      {current && ranked.length > 0 && (
        <section className="card">
          <h2>Performance over {RANGE_LABEL[range]}</h2>
          <div className="table-scroll">
            <table className="compare-table">
              <thead>
                <tr>
                  <th scope="col">Symbol</th>
                  <th scope="col">Start</th>
                  <th scope="col">Latest</th>
                  <th scope="col">Change</th>
                  <th scope="col">Best point</th>
                  <th scope="col">Worst point</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((s, i) => (
                  <tr key={s.symbol}>
                    <td>
                      <button className="symbol-cell" onClick={() => onOpen(s.symbol)}>
                        <span className="swatch" style={{ background: `var(--series-${(slots.get(s.symbol) ?? 0) + 1})` }} aria-hidden="true" />
                        <span className="watch-symbol">{s.symbol}</span>
                        <span className="muted small symbol-name">{s.name}</span>
                        {i === 0 && ranked.length > 1 && <span className="tag leader">Leader</span>}
                      </button>
                    </td>
                    <td>{formatPrice(s.startPrice, s.currency)}</td>
                    <td>{formatPrice(s.endPrice, s.currency)}</td>
                    <td className={trendClass(s.changePercent)}>
                      <strong>{formatPercent(s.changePercent)}</strong>
                    </td>
                    <td className={trendClass(s.bestPercent)}>{formatPercent(s.bestPercent)}</td>
                    <td className={trendClass(s.worstPercent)}>{formatPercent(s.worstPercent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}
