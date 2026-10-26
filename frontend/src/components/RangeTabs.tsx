import type { Range } from '../types'
import { RANGE_LABEL, RANGES } from '../lib/ranges'

interface Props {
  value: Range
  onChange: (range: Range) => void
  label?: string
}

export function RangeTabs({ value, onChange, label = 'Time range' }: Props) {
  return (
    <div className="range-tabs" role="tablist" aria-label={label}>
      {RANGES.map((r) => (
        <button
          key={r}
          role="tab"
          aria-selected={r === value}
          className={r === value ? 'active' : ''}
          onClick={() => onChange(r)}
        >
          {RANGE_LABEL[r]}
        </button>
      ))}
    </div>
  )
}
