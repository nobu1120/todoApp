import { memo } from 'react'
import type { Category, Todo } from '../types'
import { isWaiting, progressOf } from '../lib/todos'
import { findCategory } from '../lib/categories'
import { formatDue, formatDueLabel, isOverdue, isToday } from '../lib/date'
import { Icon } from './Icon'

type Props = {
  todo: Todo
  categories: Category[]
  today: string
  selecting?: boolean
  selected?: boolean
  /** 長押しでつかんでいる行。 */
  held?: boolean
  /** この行の直前に落とす。区切り線を出す。 */
  dropBefore?: boolean
  /** サブタスクを畳んでいる。 */
  collapsed?: boolean
  onPressStart?: (id: string, clientY: number) => void
  onToggle: (id: string) => void
  /** 渡すと、一覧の中でサブタスクを直接チェックできる。 */
  onToggleSubtask?: (id: string, subtaskId: string) => void
  onToggleCollapsed?: (id: string) => void
  onOpen: (id: string) => void
  onRemove: (id: string) => void
  onSelect?: (id: string) => void
}

/*
 * 行ごとに memo する。ストアが変わるたび全行を描き直していたため、
 * 設定画面でカテゴリ名を 1 文字打つたび一覧が丸ごと再描画されていた。
 * 渡している関数は useMemo / useCallback で安定しているので効く。
 */
export const TodoItem = memo(function TodoItem({
  todo,
  categories,
  today,
  selecting = false,
  selected = false,
  held = false,
  dropBefore = false,
  collapsed = false,
  onPressStart,
  onToggle,
  onToggleSubtask,
  onToggleCollapsed,
  onOpen,
  onRemove,
  onSelect,
}: Props) {
  const category = findCategory(categories, todo.categoryId)
  const progress = progressOf(todo)
  const overdue = !todo.done && isOverdue(todo.dueDate, today)
  // まだ着手日が来ていないもの。「すべて」に出るので、見分けが付くようにする。
  const waiting = !todo.done && isWaiting(todo, today)
  const dueToday = !todo.done && isToday(todo.dueDate, today)

  /*
   * サブタスクを一覧にも出す。詳細を開かずに片付けられるようにするため。
   * 完了した親の下では出さない——中身はもう済んだ話で、行数だけ増える。
   */
  const showSubtasks = onToggleSubtask !== undefined && !todo.done && todo.subtasks.length > 0

  // メタ行は、出すものがあるときだけ描画する（空行で高さが揺れないように）。
  const hasMeta =
    category !== null || progress !== null || todo.notes.trim() !== '' || waiting

  return (
    <li
      className={
        'todo-item' +
        (todo.done ? ' todo-item--done' : '') +
        (waiting ? ' todo-item--waiting' : '') +
        (held ? ' todo-item--held' : '') +
        (dropBefore ? ' todo-item--drop-before' : '') +
        (selecting && selected ? ' is-selected' : '')
      }
      data-priority={todo.priority}
      data-todo-id={todo.id}
      onTouchStart={(e) => onPressStart?.(todo.id, e.touches[0]?.clientY ?? 0)}
    >
      <label className="todo-item__check">
        <input
          className={`check check--lg${selecting ? ' check--select' : ''}`}
          type="checkbox"
          checked={selecting ? selected : todo.done}
          onChange={() => (selecting ? onSelect?.(todo.id) : onToggle(todo.id))}
          aria-label={
            selecting
              ? `${todo.title} を選ぶ`
              : `${todo.title} を${todo.done ? '未完了に戻す' : '完了にする'}`
          }
        />
      </label>

      <button
        type="button"
        className="todo-item__main"
        onClick={() => (selecting ? onSelect?.(todo.id) : onOpen(todo.id))}
      >
        <span className="todo-item__line">
          {todo.icon !== '' && (
            <span className="todo-item__emoji" aria-hidden="true">
              {todo.icon}
            </span>
          )}
          {todo.priority !== 'normal' && (
            <span className={`prio prio--${todo.priority}`} aria-label={`優先度 ${todo.priority === 'high' ? '高' : '低'}`}>
              {todo.priority === 'high' ? '高' : '低'}
            </span>
          )}
          <span className="todo-item__title">{todo.title}</span>
          {todo.repeat !== 'none' && (
            <span className="todo-item__repeat" aria-label="繰り返し">
              <Icon name="repeat" />
            </span>
          )}
        </span>

        {hasMeta && (
          <span className="todo-item__meta">
            {waiting && todo.startDate !== null && (
              <span className="todo-item__waiting">
                {formatDueLabel(todo.startDate, today)}から
              </span>
            )}
            {category !== null && (
              <span className="todo-item__cat" data-color={category.color}>
                <span className="todo-item__dot" aria-hidden="true" />
                {category.name}
              </span>
            )}
            {progress !== null && (
              <span className="todo-item__count">
                {progress.done}/{progress.total}
              </span>
            )}
            {todo.notes.trim() !== '' && (
              <span className="todo-item__note" aria-label="メモあり">
                <Icon name="note" />
              </span>
            )}
          </span>
        )}

        {/* タイトルの直下に置くと下線に見えるので、メタ行の後に出す */}
        {progress !== null && (
          <span className="progress progress--inline" aria-hidden="true">
            <span className="progress__bar" style={{ width: `${progress.ratio * 100}%` }} />
          </span>
        )}
      </button>

      {todo.dueDate !== null && (
        <span
          className={
            'todo-item__due' +
            (overdue ? ' todo-item__due--overdue' : '') +
            (dueToday ? ' todo-item__due--today' : '')
          }
        >
          {overdue && (
            <span className="todo-item__alert" aria-label="期限切れ">
              <Icon name="alert" />
            </span>
          )}
          {formatDue(todo.dueDate, todo.dueTime, today)}
        </span>
      )}

      {showSubtasks && onToggleCollapsed !== undefined && (
        <button
          type="button"
          className={`icon-button todo-item__fold${collapsed ? '' : ' is-open'}`}
          onClick={() => onToggleCollapsed(todo.id)}
          aria-expanded={!collapsed}
          aria-label={`${todo.title} のサブタスクを${collapsed ? '開く' : '畳む'}`}
        >
          <Icon name="chevron" />
        </button>
      )}

      <button
        type="button"
        className="icon-button todo-item__remove"
        onClick={() => onRemove(todo.id)}
        aria-label={`${todo.title} を削除`}
      >
        <Icon name="close" />
      </button>

      {showSubtasks && !collapsed && (
        <ul className="todo-item__subs">
          {todo.subtasks.map((subtask) => (
            <li key={subtask.id} className="todo-item__sub">
              <label className="todo-item__sub-check">
                <input
                  className="check check--sm"
                  type="checkbox"
                  checked={subtask.done}
                  /* 選択モードでは行のタップが「選ぶ」になる。紛れて押さないよう止める。 */
                  disabled={selecting}
                  onChange={() => onToggleSubtask?.(todo.id, subtask.id)}
                  aria-label={`${subtask.title} を${subtask.done ? '未完了に戻す' : '完了にする'}`}
                />
              </label>
              <span className={`todo-item__sub-title${subtask.done ? ' is-done' : ''}`}>
                {subtask.title}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
})
