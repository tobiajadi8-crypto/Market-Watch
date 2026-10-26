import { api } from '../api'
import { useFetch } from '../hooks/useFetch'
import { timeAgo } from '../lib/format'

interface Props {
  symbol: string
}

export function NewsList({ symbol }: Props) {
  const { data, error, loading } = useFetch(() => api.news(symbol), [symbol])

  return (
    <section className="card">
      <h2>Latest news</h2>
      {error && <p className="muted small">Couldn't load news: {error}</p>}
      {loading && !data && <p className="muted small">Loading…</p>}
      {data?.length === 0 && <p className="muted small">No recent news.</p>}
      <ul className="news">
        {data?.map((n) => (
          <li key={n.id}>
            <a href={n.link} target="_blank" rel="noreferrer" className="news-item">
              {n.thumbnail && <img src={n.thumbnail} alt="" loading="lazy" />}
              <div>
                <div className="news-title">{n.title}</div>
                <div className="muted small">
                  {n.publisher} · {timeAgo(n.publishedAt)}
                </div>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
