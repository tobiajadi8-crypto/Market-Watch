import type { Analysis, AnalysisRange, Comparison, History, NewsItem, Quote, Range, SearchResult, Summary } from './types'

// Empty by default so requests go through the Vite proxy; set VITE_API_URL for production.
const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`)
  return body as T
}

const enc = encodeURIComponent

export const api = {
  search: (q: string) => request<SearchResult[]>(`/search?q=${enc(q)}`),
  quotes: (symbols: string[]) => request<Quote[]>(`/quotes?symbols=${symbols.map(enc).join(',')}`),
  indices: () => request<Quote[]>('/market/indices'),
  history: (symbol: string, range: Range) => request<History>(`/stocks/${enc(symbol)}/history?range=${range}`),
  summary: (symbol: string) => request<Summary>(`/stocks/${enc(symbol)}/summary`),
  news: (symbol: string) => request<NewsItem[]>(`/stocks/${enc(symbol)}/news`),
  analysis: (symbol: string, range: AnalysisRange, days: number) =>
    request<Analysis>(`/stocks/${enc(symbol)}/analysis?range=${range}&days=${days}`),
  compare: (symbols: string[], range: Range) =>
    request<Comparison>(`/compare?symbols=${symbols.map(enc).join(',')}&range=${range}`),

  watchlist: () => request<string[]>('/watchlist'),
  addToWatchlist: (symbol: string) =>
    request<string[]>('/watchlist', { method: 'POST', body: JSON.stringify({ symbol }) }),
  removeFromWatchlist: (symbol: string) => request<string[]>(`/watchlist/${enc(symbol)}`, { method: 'DELETE' }),
}
