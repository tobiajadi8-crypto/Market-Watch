import type { Range } from '../types'

export const RANGES: Range[] = ['1d', '5d', '1mo', '6mo', '1y', '5y']

export const RANGE_LABEL: Record<Range, string> = {
  '1d': '1D',
  '5d': '5D',
  '1mo': '1M',
  '6mo': '6M',
  '1y': '1Y',
  '5y': '5Y',
}
