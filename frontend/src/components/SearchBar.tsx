import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { SearchResult } from '../types'

interface Props {
  onSelect: (symbol: string) => void
  placeholder?: string
  className?: string
}

export function SearchBar({ onSelect, placeholder = 'Search stocks, ETFs, crypto…', className = '' }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  // Debounced search as the user types.
  useEffect(() => {
    const q = query.trim()
    if (!q) return
    let cancelled = false
    const id = setTimeout(() => {
      api
        .search(q)
        .then((r) => {
          if (cancelled) return
          setResults(r)
          setActive(0)
          setOpen(true)
        })
        .catch(() => !cancelled && setResults([]))
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [query])

  // Close the dropdown when clicking elsewhere.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function choose(symbol: string) {
    onSelect(symbol)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      const pick = results[active]?.symbol ?? query.trim().toUpperCase()
      if (pick) choose(pick)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className={`search ${className}`} ref={boxRef}>
      <input
        type="search"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          if (!e.target.value.trim()) setResults([])
        }}
        onFocus={() => results.length && setOpen(true)}
        onKeyDown={onKeyDown}
        aria-label={placeholder}
      />
      {open && results.length > 0 && (
        <ul className="search-results" role="listbox">
          {results.map((r, i) => (
            <li
              key={r.symbol}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onMouseEnter={() => setActive(i)}
              onMouseDown={() => choose(r.symbol)}
            >
              <span className="search-symbol">{r.symbol}</span>
              <span className="search-name">{r.name}</span>
              <span className="search-meta">
                {r.type} · {r.exchange}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
