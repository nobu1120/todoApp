import type { Category, Todo } from '../types'
import { progressOf } from '../lib/todos'
import { findCategory } from '../lib/categories'
import { formatDue, isOverdue, isToday } from '../lib/date'
import { Icon } from './Icon'

type Props = {
  todo: Todo
  categories: Category[]
  today: string
  onToggle: (id: string) => void
  onOpen: (id: string) => void
  onRemove: (id: string) => void
}

export function TodoItem({ todo, categories, today, onToggle, onOpen, onRemove }: Props) {
  const category = findCategory(categories, todo.categoryId)
  const progress = progressOf(todo)
  const overdue = !todo.done && isOverdue(todo.dueDate, today)
  const dueToday = !todo.done && isToday(todo.dueDate, today)

  // メタ行は、出すものがあるときだけ描画する（空行で高さが揺れないように）。
  const hasMeta = category !== null || progress !== null || todo.notes.trim() !== ''

  return (
    <li className={`todo-item${todo.done ? ' todo-item--done' : ''}`} data-color={category?.color}>
      {category !== null && <span className="todo-item__bar" aria-hidden="true" />}

      <label className="todo-item__check">
        <input
          type="checkbox"
          checked={todo.done}
          onChange={() => onToggle(todo.id)}
          aria-label={`${todo.title} を${todo.done ? '未完了に戻す' : '完了にする'}`}
        />
      </label>

      <button type="button" className="todo-item__main" onClick={() => onOpen(todo.id)}>
        <span className="todo-item__line">
          {todo.icon !== '' && (
            <span className="todo-item__emoji" aria-hidden="true">
              {todo.icon}
            </span>
          )}
          <span className="todo-item__title">{todo.title}</span>
        </span>

        {hasMeta && (
          <span className="todo-item__meta">
            {category !== null && <span className="todo-item__cat">{category.name}</span>}
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

      <button
        type="button"
        className="icon-button todo-item__remove"
        onClick={() => onRemove(todo.id)}
        aria-label={`${todo.title} を削除`}
      >
        <Icon name="close" />
      </button>
    </li>
  )
}
