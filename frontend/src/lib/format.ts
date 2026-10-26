const DASH = '—'

export function formatPrice(value: number | null | undefined, currency = 'USD'): string {
  if (value == null) return DASH
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)
  } catch {
    return value.toFixed(2)
  }
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value == null) return DASH
  return value.toLocaleString('en-US', { maximumFractionDigits: digits })
}

/** 1234567 -> "1.23M" */
export function formatCompact(value: number | null | undefined): string {
  if (value == null) return DASH
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)
}

export function formatChange(value: number | null | undefined): string {
  if (value == null) return DASH
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return DASH
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export function trendClass(value: number | null | undefined): string {
  if (value == null || value === 0) return 'flat'
  return value > 0 ? 'up' : 'down'
}

export function timeAgo(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}
