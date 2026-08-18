import { useState } from 'react'
import type { Category, Priority, Repeat, Todo } from '../types'
import type { TodoPatch } from '../lib/todos'
import { progressOf } from '../lib/todos'
import { formatDueLabel, parseISODate, weekdayOrdinal } from '../lib/date'

const WEEKDAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

/** 「第2火曜」のように、その日が月の中で占める位置を日本語にする。 */
const nthLabel = (iso: string) =>
  `第${weekdayOrdinal(iso)}${WEEKDAY_NAMES[parseISODate(iso).getDay()]}曜`
import { Icon } from './Icon'
import { EmojiPicker } from './EmojiPicker'
import { SubtaskList } from './SubtaskList'

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'high', label: '高' },
  { value: 'normal', label: '標準' },
  { value: 'low', label: '低' },
]

const REPEATS: { value: Repeat; label: string }[] = [
  { value: 'none', label: '繰り返さない' },
  { value: 'daily', label: '毎日' },
  { value: 'weekday', label: '平日' },
  { value: 'weekly', label: '毎週' },
  { value: 'monthly', label: '毎月' },
  { value: 'monthly-weekday', label: '毎月の同じ週' },
]

type Props = {
  todo: Todo
  categories: Category[]
  onUpdate: (patch: TodoPatch) => void
  onAddSubtask: (title: string) => void
  onToggleSubtask: (subtaskId: string) => void
  onRenameSubtask: (subtaskId: string, title: string) => void
  onRemoveSubtask: (subtaskId: string) => void
  onRemove: () => void
  onToggle: () => void
  today: string
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
  onToggle,
  today,
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

        {/*
          * 詳細を見て「もう終わってた」と気づいたとき、閉じて一覧へ戻る
          * 必要が無いようにする。
          */}
        <label className="detail__done">
          <input type="checkbox" checked={todo.done} onChange={onToggle} />
          <span>完了</span>
        </label>

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
        <h3 className="detail__label">日付</h3>
        {/*
          * 着手日と期限は「いつからいつまで」で 1 組なので同じ行に並べる。
          * 節を分けると、片方だけ見て設定してしまう。
          */}
        <div className="detail__dates">
          <label className="detail__date">
            <span>着手日</span>
            <input
              type="date"
              value={todo.startDate ?? ''}
              max={todo.dueDate ?? undefined}
              onChange={(e) =>
                onUpdate({ startDate: e.target.value === '' ? null : e.target.value })
              }
              aria-label="着手日"
            />
          </label>

          <span className="detail__dates-arrow" aria-hidden="true">
            〜
          </span>

          <label className="detail__date">
            <span>期限</span>
            <input
              type="date"
              value={todo.dueDate ?? ''}
              onChange={(e) => onUpdate({ dueDate: e.target.value === '' ? null : e.target.value })}
              aria-label="期限の日付"
            />
          </label>

          <label className="detail__date detail__date--time">
            <span>時刻</span>
            <input
              type="time"
              value={todo.dueTime ?? ''}
              onChange={(e) => onUpdate({ dueTime: e.target.value === '' ? null : e.target.value })}
              disabled={todo.dueDate === null}
              aria-label="期限の時刻"
            />
          </label>
        </div>

        <div className="chip-row">
          {todo.startDate !== null && (
            <button type="button" className="chip" onClick={() => onUpdate({ startDate: null })}>
              着手日をなくす
            </button>
          )}
          {todo.dueDate !== null && (
            <button
              type="button"
              className="chip"
              onClick={() => onUpdate({ dueDate: null, dueTime: null })}
            >
              期限をなくす
            </button>
          )}
          <button
            type="button"
            className={`chip${todo.someday ? ' is-selected' : ''}`}
            onClick={() =>
              onUpdate(
                todo.someday
                  ? { someday: false }
                  : { someday: true, dueDate: null, dueTime: null, startDate: null },
              )
            }
            aria-pressed={todo.someday}
          >
            いつか
          </button>
        </div>

        {todo.startDate !== null && todo.startDate > today && (
          <p className="detail__hint">
            {formatDueLabel(todo.startDate, today)}まで一覧に出しません。
          </p>
        )}
        {todo.dueDate !== null && todo.dueTime === null && (
          <p className="detail__hint">時刻を入れないと、設定した既定の時刻に通知します。</p>
        )}

        {/* 繰り返しは期限があって初めて意味を持つ。無いときは出さない。 */}
        {todo.dueDate !== null && (
          <div className="chip-row" role="group" aria-label="繰り返し">
            {REPEATS.map((r) => (
              <button
                key={r.value}
                type="button"
                className={`chip${todo.repeat === r.value ? ' is-selected' : ''}`}
                onClick={() => onUpdate({ repeat: r.value })}
                aria-pressed={todo.repeat === r.value}
              >
                {r.value !== 'none' && <Icon name="repeat" />}
                {r.value === 'monthly-weekday' && todo.dueDate !== null
                  ? `毎月 ${nthLabel(todo.dueDate)}`
                  : r.label}
              </button>
            ))}
          </div>
        )}
        {todo.dueDate !== null && todo.repeat !== 'none' && (
          <p className="detail__hint">完了にすると、次回ぶんが自動で作られます。</p>
        )}
      </section>

      <section className="detail__section">
        <h3 className="detail__label">優先度</h3>
        <div className="chip-row" role="group" aria-label="優先度">
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`chip chip--priority${todo.priority === p.value ? ' is-selected' : ''}`}
              data-priority={p.value}
              onClick={() => onUpdate({ priority: p.value })}
              aria-pressed={todo.priority === p.value}
            >
              {p.label}
            </button>
          ))}
        </div>
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
