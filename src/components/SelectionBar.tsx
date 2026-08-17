import { Icon } from './Icon'

type Props = {
  count: number
  total: number
  onSelectAll: () => void
  onClear: () => void
  onDone: () => void
  onDueToday: () => void
  onDueTomorrow: () => void
  onRemove: () => void
}

/**
 * まとめて操作するときの下部バー。
 * 「今週こなせなかったぶんを全部明日に」のような直し方を、1 件ずつ開かずに済ませる。
 */
export function SelectionBar({
  count,
  total,
  onSelectAll,
  onClear,
  onDone,
  onDueToday,
  onDueTomorrow,
  onRemove,
}: Props) {
  const none = count === 0

  return (
    <div className="selection-bar" role="toolbar" aria-label="選んだタスクの操作">
      <div className="selection-bar__head">
        <span className="selection-bar__count">{count} 件を選択</span>
        <button type="button" className="ghost" onClick={count === total ? onClear : onSelectAll}>
          {count === total ? '選択を解除' : 'すべて選ぶ'}
        </button>
      </div>

      <div className="selection-bar__actions">
        <button type="button" onClick={onDone} disabled={none}>
          <Icon name="check" />
          完了
        </button>
        <button type="button" onClick={onDueToday} disabled={none}>
          <Icon name="calendar" />
          今日
        </button>
        <button type="button" onClick={onDueTomorrow} disabled={none}>
          <Icon name="calendar" />
          明日
        </button>
        <button type="button" className="danger-button" onClick={onRemove} disabled={none}>
          <Icon name="trash" />
          削除
        </button>
      </div>
    </div>
  )
}
