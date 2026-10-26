import { api } from '../api'
import { useFetch } from '../hooks/useFetch'
import { formatNumber, formatPercent, trendClass } from '../lib/format'

interface Props {
  onSelect: (symbol: string) => void
}

export function IndexTicker({ onSelect }: Props) {
  const { data } = useFetch(api.indices, [], 30_000)

  return (
    <div className="indices">
      {(data ?? []).map((q) => (
        <button key={q.symbol} className="index-chip" onClick={() => onSelect(q.symbol)}>
          <span className="index-name">{q.name}</span>
          <span className="index-price">{formatNumber(q.price)}</span>
          <span className={`index-change ${trendClass(q.changePercent)}`}>{formatPercent(q.changePercent)}</span>
        </button>
      ))}
    </div>
  )
}
