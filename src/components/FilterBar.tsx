import type { Category, Filter, StatusFilter } from '../types'

const STATUSES: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'active', label: '未完了' },
  { value: 'today', label: '今日' },
  { value: 'overdue', label: '期限切れ' },
  { value: 'done', label: '完了' },
]

type Props = {
  filter: Filter
  counts: Record<StatusFilter, number>
  categories: Category[]
  categoryCounts: Record<string, number>
  onChange: (filter: Filter) => void
}

export function FilterBar({ filter, counts, categories, categoryCounts, onChange }: Props) {
  // 使っていないカテゴリを並べても選ぶ意味がないので、件数があるものだけ出す。
  const usedCategories = categories.filter((c) => (categoryCounts[c.id] ?? 0) > 0)

  return (
    <div className="filter-bar">
      <nav className="filter-bar__row" aria-label="状態で絞り込み">
        {STATUSES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className="filter"
            aria-current={filter.status === value}
            onClick={() => onChange({ ...filter, status: value })}
          >
            {label}
            <span className="filter__count">{counts[value]}</span>
          </button>
        ))}
      </nav>

      {usedCategories.length > 0 && (
        <nav className="filter-bar__row" aria-label="カテゴリで絞り込み">
          <button
            type="button"
            className={`chip${filter.categoryId === null ? ' is-selected' : ''}`}
            onClick={() => onChange({ ...filter, categoryId: null })}
            aria-pressed={filter.categoryId === null}
          >
            全カテゴリ
          </button>
          {usedCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`chip chip--cat${filter.categoryId === category.id ? ' is-selected' : ''}`}
              data-color={category.color}
              onClick={() =>
                onChange({
                  ...filter,
                  // 同じカテゴリをもう一度押したら解除する。
                  categoryId: filter.categoryId === category.id ? null : category.id,
                })
              }
              aria-pressed={filter.categoryId === category.id}
            >
              <span className="chip__dot" aria-hidden="true" />
              {category.name}
              <span className="chip__count">{categoryCounts[category.id]}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}
