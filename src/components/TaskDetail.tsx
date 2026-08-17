import { useState } from 'react'
import type { Category, Todo } from '../types'
import type { TodoPatch } from '../lib/todos'
import { progressOf } from '../lib/todos'
import { Icon } from './Icon'
import { EmojiPicker } from './EmojiPicker'
import { SubtaskList } from './SubtaskList'

type Props = {
  todo: Todo
  categories: Category[]
  onUpdate: (patch: TodoPatch) => void
  onAddSubtask: (title: string) => void
  onToggleSubtask: (subtaskId: string) => void
  onRenameSubtask: (subtaskId: string, title: string) => void
  onRemoveSubtask: (subtaskId: string) => void
  onRemove: () => void
}

export function TaskDetail({
  todo,
  categories,
  onUpdate,
  onAddSubtask,
  onToggleSubtask,
  onRenameSubtask,
  onRemoveSubtask,
  onRemove,
}: Props) {
  const [pickingIcon, setPickingIcon] = useState(false)
  const progress = progressOf(todo)

  return (
    <div className="detail">
      <div className="detail__head">
        <button
          type="button"
          className="detail__icon"
          onClick={() => setPickingIcon((v) => !v)}
          aria-expanded={pickingIcon}
          aria-label="アイコンを選ぶ"
        >
          {todo.icon === '' ? <Icon name="plus" /> : todo.icon}
        </button>

        <input
          className="detail__title"
          value={todo.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="タスク名"
          aria-label="タスク名"
        />
      </div>

      {pickingIcon && (
        <EmojiPicker
          value={todo.icon}
          onChange={(icon) => {
            onUpdate({ icon })
            setPickingIcon(false)
          }}
        />
      )}

      <section className="detail__section">
        <h3 className="detail__label">カテゴリ</h3>
        <div className="chip-row">
          <button
            type="button"
            className={`chip${todo.categoryId === null ? ' is-selected' : ''}`}
            onClick={() => onUpdate({ categoryId: null })}
            aria-pressed={todo.categoryId === null}
          >
            未分類
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`chip chip--cat${todo.categoryId === category.id ? ' is-selected' : ''}`}
              data-color={category.color}
              onClick={() => onUpdate({ categoryId: category.id })}
              aria-pressed={todo.categoryId === category.id}
            >
              <span className="chip__dot" aria-hidden="true" />
              {category.name}
            </button>
          ))}
        </div>
      </section>

      <section className="detail__section">
        <h3 className="detail__label">期限</h3>
        <div className="detail__due">
          <input
            type="date"
            value={todo.dueDate ?? ''}
            onChange={(e) => onUpdate({ dueDate: e.target.value === '' ? null : e.target.value })}
            aria-label="期限の日付"
          />
          <input
            type="time"
            value={todo.dueTime ?? ''}
            onChange={(e) => onUpdate({ dueTime: e.target.value === '' ? null : e.target.value })}
            disabled={todo.dueDate === null}
            aria-label="期限の時刻"
          />
          {todo.dueDate !== null && (
            <button
              type="button"
              className="ghost"
              onClick={() => onUpdate({ dueDate: null, dueTime: null })}
            >
              クリア
            </button>
          )}
        </div>
        {todo.dueDate !== null && todo.dueTime === null && (
          <p className="detail__hint">時刻を入れないと、設定した既定の時刻に通知します。</p>
        )}
      </section>

      <section className="detail__section">
        <div className="detail__section-head">
          <h3 className="detail__label">サブタスク</h3>
          {progress !== null && (
            <span className="detail__progress-text">
              {progress.done} / {progress.total}
            </span>
          )}
        </div>
        {progress !== null && (
          <div
            className="progress"
            role="progressbar"
            aria-valuenow={Math.round(progress.ratio * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="progress__bar" style={{ width: `${progress.ratio * 100}%` }} />
          </div>
        )}
        <SubtaskList
          subtasks={todo.subtasks}
          onAdd={onAddSubtask}
          onToggle={onToggleSubtask}
          onRename={onRenameSubtask}
          onRemove={onRemoveSubtask}
        />
      </section>

      <section className="detail__section">
        <h3 className="detail__label">メモ</h3>
        <textarea
          className="detail__notes"
          value={todo.notes}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          placeholder="詳細、手順、リンクなど"
          rows={6}
          aria-label="メモ"
        />
      </section>

      <button type="button" className="danger-button" onClick={onRemove}>
        <Icon name="trash" />
        このタスクを削除
      </button>
    </div>
  )
}
