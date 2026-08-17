import type { Category, Filter, SortMode, StatusFilter } from '../types'
import { Icon } from './Icon'

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
  sortMode: SortMode
  /** 選択モードに入っているか。入っている間は絞り込みを隠す。 */
  selecting: boolean
  onChange: (filter: Filter) => void
  onChangeSort: (mode: SortMode) => void
  onToggleSelecting: () => void
}

export function FilterBar({
  filter,
  counts,
  categories,
  categoryCounts,
  sortMode,
  selecting,
  onChange,
  onChangeSort,
  onToggleSelecting,
}: Props) {
  // 使っていないカテゴリを並べても選ぶ意味がないので、件数があるものだけ出す。
  const usedCategories = categories.filter((c) => (categoryCounts[c.id] ?? 0) > 0)

  return (
    <div className="filter-bar">
      <div className="search">
        <span className="search__icon" aria-hidden="true">
          <Icon name="search" />
        </span>
        <input
          className="search__input"
          type="search"
          value={filter.query}
          onChange={(e) => onChange({ ...filter, query: e.target.value })}
          placeholder="タスクを探す"
          aria-label="タスクを探す"
        />
        {filter.query !== '' && (
          <button
            type="button"
            className="icon-button search__clear"
            onClick={() => onChange({ ...filter, query: '' })}
            aria-label="検索をクリア"
          >
            <Icon name="close" />
          </button>
        )}
        <button
          type="button"
          className={`icon-button${selecting ? ' is-selected' : ''}`}
          onClick={onToggleSelecting}
          aria-pressed={selecting}
          aria-label={selecting ? '選択をやめる' : 'まとめて選ぶ'}
        >
          {/* 選択中も同じアイコンのまま。× にすると、隣の検索クリアと見分けがつかない。 */}
          <Icon name="check-list" />
        </button>
      </div>

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

        {/* 並び順はここに置く。絞り込みと同じ「一覧の見え方」の操作なので。 */}
        <button
          type="button"
          className="filter filter--sort"
          onClick={() => onChangeSort(sortMode === 'due' ? 'priority' : 'due')}
          aria-label={`並び順: ${sortMode === 'due' ? '期限順' : '優先度順'}（押すと切り替え）`}
        >
          <Icon name="sort" />
          {sortMode === 'due' ? '期限順' : '優先度順'}
        </button>
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
