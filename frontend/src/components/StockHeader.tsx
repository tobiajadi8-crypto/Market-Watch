import type { Quote } from '../types'
import { formatChange, formatPercent, formatPrice, trendClass } from '../lib/format'

interface Props {
  quote: Quote
  inWatchlist: boolean
  onToggleWatchlist: () => void
  onCompare: () => void
}

const MARKET_STATE: Record<string, string> = {
  REGULAR: 'Market open',
  PRE: 'Pre-market',
  POST: 'After hours',
  POSTPOST: 'After hours',
  PREPRE: 'Market closed',
  CLOSED: 'Market closed',
}

export function StockHeader({ quote, inWatchlist, onToggleWatchlist, onCompare }: Props) {
  const trend = trendClass(quote.change)

  return (
    <div className="stock-header">
      <div>
        <div className="stock-title">
          <h1>{quote.symbol}</h1>
          <span className="muted">{quote.name}</span>
        </div>
        <div className="stock-price-row">
          <span className="stock-price">{formatPrice(quote.price, quote.currency)}</span>
          <span className={`stock-change ${trend}`}>
            {formatChange(quote.change)} ({formatPercent(quote.changePercent)})
          </span>
        </div>
        <div className="muted small">
          {quote.exchange} · {quote.currency}
          {quote.marketState && ` · ${MARKET_STATE[quote.marketState] ?? quote.marketState}`}
        </div>
      </div>
      <div className="header-actions">
        <button className="btn btn-quiet" onClick={onCompare}>
          Compare
        </button>
        <button className={`btn ${inWatchlist ? 'btn-ghost' : 'btn-primary'}`} onClick={onToggleWatchlist}>
          {inWatchlist ? 'Watching' : 'Add to watchlist'}
        </button>
      </div>
    </div>
  )
}
