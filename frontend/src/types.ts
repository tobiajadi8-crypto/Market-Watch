export type Range = '1d' | '5d' | '1mo' | '6mo' | '1y' | '5y'

export interface Quote {
  symbol: string
  name: string
  price: number | null
  change: number | null
  changePercent: number | null
  previousClose: number | null
  open: number | null
  dayHigh: number | null
  dayLow: number | null
  volume: number | null
  marketCap: number | null
  currency: string
  exchange: string | null
  marketState: string | null
}

export interface PricePoint {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface History {
  symbol: string
  range: Range
  interval: string
  points: PricePoint[]
}

export interface Summary {
  symbol: string
  name: string
  sector: string | null
  industry: string | null
  website: string | null
  employees: number | null
  description: string | null
  stats: {
    marketCap: number | null
    peRatio: number | null
    forwardPE: number | null
    eps: number | null
    beta: number | null
    dividendYield: number | null
    fiftyTwoWeekHigh: number | null
    fiftyTwoWeekLow: number | null
    averageVolume: number | null
  }
}

export interface SearchResult {
  symbol: string
  name: string
  type: string
  exchange: string
}

export interface NewsItem {
  id: string
  title: string
  publisher: string
  link: string
  publishedAt: string
  thumbnail: string | null
}

/** Ranges the analysis endpoint supports (the chart ranges that use daily candles). */
export type AnalysisRange = '1mo' | '6mo' | '1y'
export const ANALYSIS_RANGES: AnalysisRange[] = ['1mo', '6mo', '1y']
export const FORECAST_DAYS = [5, 10, 20] as const
export type ForecastDays = (typeof FORECAST_DAYS)[number]

export interface AnalysisPoint {
  time: number
  close: number
  ma20: number | null
  ma50: number | null
}

export interface Analysis {
  symbol: string
  range: AnalysisRange
  latestPrice: number
  /** Fraction, e.g. 0.012 for +1.2% */
  dailyReturn: number | null
  ma20: number | null
  ma50: number | null
  trend: 'above' | 'below' | null
  points: AnalysisPoint[]
  forecast: {
    days: number
    /** Price change per trading day from the regression fit */
    slope: number
    r2: number
    direction: 'upward' | 'downward'
    changePercent: number
    points: { time: number; close: number }[]
  }
}

export interface CompareSeries {
  symbol: string
  name: string
  currency: string
  startPrice: number
  endPrice: number
  changePercent: number
  bestPercent: number
  worstPercent: number
}

export interface Comparison {
  range: Range
  interval: string
  series: CompareSeries[]
  /** One row per time; each symbol key holds its % change since the start of the range. */
  points: ({ time: number } & Record<string, number>)[]
  errors: { symbol: string; error: string }[]
}
