import type { Filter } from '../types'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'active', label: '未完了' },
  { value: 'today', label: '今日' },
  { value: 'overdue', label: '期限切れ' },
  { value: 'done', label: '完了' },
]

type Props = {
  current: Filter
  counts: Record<Filter, number>
  onChange: (filter: Filter) => void
}

export function FilterBar({ current, counts, onChange }: Props) {
  return (
    <nav className="filter-bar" aria-label="絞り込み">
      {FILTERS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          className="filter-bar__item"
          aria-current={current === value}
          onClick={() => onChange(value)}
        >
          {label}
          <span className="filter-bar__count">{counts[value]}</span>
        </button>
      ))}
    </nav>
  )
}
