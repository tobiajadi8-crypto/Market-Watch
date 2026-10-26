import { useEffect, useState } from 'react'
import { api } from './api'
import { useFetch } from './hooks/useFetch'
import { ANALYSIS_RANGES } from './types'
import type { AnalysisRange, ForecastDays, Range } from './types'
import { SearchBar } from './components/SearchBar'
import { IndexTicker } from './components/IndexTicker'
import { Watchlist } from './components/Watchlist'
import { StockHeader } from './components/StockHeader'
import { PriceChart } from './components/PriceChart'
import { AnalysisCard } from './components/AnalysisCard'
import { CompareView, MAX_COMPARE } from './components/CompareView'
import { KeyStats } from './components/KeyStats'
import { CompanyProfile } from './components/CompanyProfile'
import { NewsList } from './components/NewsList'

// The view lives in the URL hash so refreshes and shared links keep it:
//   #AAPL                 -> dashboard for AAPL
//   #compare/AAPL,MSFT    -> comparison view
type Route = { view: 'stock'; symbol: string } | { view: 'compare'; symbols: string[] }

function routeFromHash(): Route {
  const hash = decodeURIComponent(window.location.hash.slice(1))
  if (hash.toLowerCase().startsWith('compare')) {
    const symbols = hash
      .slice('compare'.length)
      .replace(/^\//, '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
    return { view: 'compare', symbols: [...new Set(symbols)].slice(0, MAX_COMPARE) }
  }
  return { view: 'stock', symbol: hash.toUpperCase() || 'AAPL' }
}

function compareHash(symbols: string[]): string {
  return `compare/${symbols.map(encodeURIComponent).join(',')}`
}

export default function App() {
  const [route, setRoute] = useState(routeFromHash)
  const [lastSymbol, setLastSymbol] = useState(route.view === 'stock' ? route.symbol : 'AAPL')
  const [range, setRange] = useState<Range>('6mo')
  const [forecastDays, setForecastDays] = useState<ForecastDays>(5)
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [watchlistError, setWatchlistError] = useState<string | null>(null)

  useEffect(() => {
    const onHash = () => {
      const next = routeFromHash()
      setRoute(next)
      if (next.view === 'stock') setLastSymbol(next.symbol)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    api.watchlist().then(setWatchlist).catch((e: Error) => setWatchlistError(e.message))
  }, [])

  const select = (s: string) => {
    window.location.hash = encodeURIComponent(s.toUpperCase())
  }

  const openCompare = (symbols: string[]) => {
    window.location.hash = compareHash(symbols)
  }

  // Default comparison: the current stock against the first watchlist name that isn't it.
  const defaultCompare = () => {
    const other = watchlist.find((s) => s !== lastSymbol)
    return other ? [lastSymbol, other] : [lastSymbol]
  }

  const symbol = route.view === 'stock' ? route.symbol : lastSymbol
  const onStock = route.view === 'stock'

  // Analysis runs on daily closes, so it follows the chart range when that range is daily.
  const analysisRange: AnalysisRange = (ANALYSIS_RANGES as Range[]).includes(range) ? (range as AnalysisRange) : '6mo'

  const quoteState = useFetch(() => api.quotes([symbol]), [symbol], 15_000)
  const quote = quoteState.data?.find((q) => q.symbol === symbol) ?? null
  const summaryState = useFetch(() => api.summary(symbol), [symbol])
  const summary = summaryState.data?.symbol === symbol ? summaryState.data : null
  const analysisState = useFetch(
    () => api.analysis(symbol, analysisRange, forecastDays),
    [symbol, analysisRange, forecastDays],
  )
  // While a new forecast length loads, keep showing the previous one for the same stock and range.
  const analysis =
    analysisState.data?.symbol === symbol && analysisState.data.range === analysisRange ? analysisState.data : null

  const inWatchlist = watchlist.includes(symbol)

  async function toggleWatchlist(s: string) {
    try {
      setWatchlist(watchlist.includes(s) ? await api.removeFromWatchlist(s) : await api.addToWatchlist(s))
      setWatchlistError(null)
    } catch (e) {
      setWatchlistError((e as Error).message)
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href={`#${encodeURIComponent(lastSymbol)}`}>
          <svg
            className="logo"
            viewBox="0 0 28 28"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 20l6-6 5 4 8-9" />
            <path d="M3 25h22" opacity="0.4" />
            <circle cx="22.5" cy="8.5" r="2.6" fill="currentColor" stroke="none" />
          </svg>
          Market Watch
        </a>
        <nav className="view-tabs" aria-label="Views">
          <a href={`#${encodeURIComponent(lastSymbol)}`} aria-current={onStock ? 'page' : undefined}>
            Dashboard
          </a>
          <a
            href={`#${route.view === 'compare' ? compareHash(route.symbols) : compareHash(defaultCompare())}`}
            aria-current={!onStock ? 'page' : undefined}
          >
            Compare
          </a>
        </nav>
        <SearchBar onSelect={select} />
      </header>

      <IndexTicker onSelect={select} />

      {watchlistError && <div className="banner">Backend problem: {watchlistError}. Is the API running on port 5000?</div>}

      <div className="layout">
        <Watchlist symbols={watchlist} selected={onStock ? symbol : ''} onSelect={select} onRemove={toggleWatchlist} />

        <main className="main">
          {route.view === 'compare' ? (
            <CompareView symbols={route.symbols} watchlist={watchlist} onChange={openCompare} onOpen={select} />
          ) : quote ? (
            <>
              <section className="card">
                <StockHeader
                  quote={quote}
                  inWatchlist={inWatchlist}
                  onToggleWatchlist={() => toggleWatchlist(symbol)}
                  onCompare={() => openCompare(defaultCompare())}
                />
              </section>
              <PriceChart
                symbol={symbol}
                currency={quote.currency}
                range={range}
                onRangeChange={setRange}
                analysis={analysis}
              />
              <AnalysisCard
                analysis={analysis}
                loading={analysisState.loading}
                error={analysisState.error}
                currency={quote.currency}
                range={analysisRange}
                days={forecastDays}
                onDaysChange={setForecastDays}
              />
              <div className="two-col">
                <KeyStats quote={quote} summary={summary} />
                <NewsList symbol={symbol} />
              </div>
              {summary && <CompanyProfile summary={summary} />}
            </>
          ) : (
            <section className="card empty">
              {quoteState.loading ? (
                <p className="muted">Loading {symbol}…</p>
              ) : (
                <p className="muted">
                  {quoteState.error ?? `No quote found for "${symbol}".`} Try searching for another ticker.
                </p>
              )}
            </section>
          )}
        </main>
      </div>

      <footer className="footer muted small">
        Market Watch. Quotes come from Yahoo Finance and may be delayed. Forecasts are simple trend lines, not
        financial advice.
      </footer>
    </div>
  )
}
