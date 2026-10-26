import { api } from '../api'
import { useFetch } from '../hooks/useFetch'
import { formatPercent, formatPrice, trendClass } from '../lib/format'

interface Props {
  symbols: string[]
  selected: string
  onSelect: (symbol: string) => void
  onRemove: (symbol: string) => void
}

export function Watchlist({ symbols, selected, onSelect, onRemove }: Props) {
  const key = symbols.join(',')
  const { data: quotes, error } = useFetch(
    () => (symbols.length ? api.quotes(symbols) : Promise.resolve([])),
    [key],
    20_000,
  )
  const bySymbol = new Map((quotes ?? []).map((q) => [q.symbol, q]))

  return (
    <aside className="card watchlist">
      <h2>Watchlist</h2>
      {error && <p className="muted small">Couldn't refresh prices: {error}</p>}
      {symbols.length === 0 && <p className="muted small">Search for a stock and add it here.</p>}
      <ul>
        {symbols.map((symbol) => {
          const q = bySymbol.get(symbol)
          return (
            <li key={symbol} className={symbol === selected ? 'selected' : ''}>
              <button className="watch-row" onClick={() => onSelect(symbol)}>
                <span className="watch-left">
                  <span className="watch-symbol">{symbol}</span>
                  <span className="watch-name">{q?.name ?? ''}</span>
                </span>
                <span className="watch-right">
                  <span className="watch-price">{q ? formatPrice(q.price, q.currency) : '…'}</span>
                  <span className={`pill ${trendClass(q?.changePercent)}`}>{formatPercent(q?.changePercent)}</span>
                </span>
              </button>
              <button className="remove" title={`Remove ${symbol}`} onClick={() => onRemove(symbol)}>
                ×
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
