import type { Quote, Summary } from '../types'
import { formatCompact, formatNumber, formatPrice } from '../lib/format'

interface Props {
  quote: Quote
  summary: Summary | null
}

export function KeyStats({ quote, summary }: Props) {
  const s = summary?.stats
  const c = quote.currency

  const rows: [string, string][] = [
    ['Open', formatPrice(quote.open, c)],
    ['Previous close', formatPrice(quote.previousClose, c)],
    ['Day range', `${formatPrice(quote.dayLow, c)} – ${formatPrice(quote.dayHigh, c)}`],
    ['52-week range', `${formatPrice(s?.fiftyTwoWeekLow, c)} – ${formatPrice(s?.fiftyTwoWeekHigh, c)}`],
    ['Volume', formatCompact(quote.volume)],
    ['Avg. volume', formatCompact(s?.averageVolume)],
    ['Market cap', formatCompact(quote.marketCap ?? s?.marketCap)],
    ['P/E (TTM)', formatNumber(s?.peRatio)],
    ['Forward P/E', formatNumber(s?.forwardPE)],
    ['EPS (TTM)', formatNumber(s?.eps)],
    ['Beta', formatNumber(s?.beta)],
    ['Dividend yield', s?.dividendYield != null ? `${(s.dividendYield * 100).toFixed(2)}%` : '—'],
  ]

  return (
    <section className="card">
      <h2>Key stats</h2>
      <dl className="stats-grid">
        {rows.map(([label, value]) => (
          <div key={label} className="stat">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
