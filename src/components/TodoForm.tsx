import { useRef, useState, type FormEvent } from 'react'
import type { Category } from '../types'
import type { NewTodoInput } from '../lib/todos'
import { formatDueLabel } from '../lib/date'
import { Icon } from './Icon'

type Props = {
  categories: Category[]
  today: string
  /** カテゴリで絞り込み中なら、それを初期カテゴリにする。 */
  defaultCategoryId: string | null
  onAdd: (input: NewTodoInput) => void
}

export function TodoForm({ categories, today, defaultCategoryId, onAdd }: Props) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(defaultCategoryId)
  const [showOptions, setShowOptions] = useState(false)
  const [editingDate, setEditingDate] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)

  const canSubmit = title.trim() !== ''

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return

    onAdd({
      title,
      dueDate: dueDate === '' ? null : dueDate,
      categoryId,
    })
    setTitle('')
    setDueDate('')
    setCategoryId(defaultCategoryId)
    setShowOptions(false)
    // 続けて入力できるようにフォーカスを戻す。
    titleRef.current?.focus()
  }

  // 期限は任意の補助情報なので、既定ではチップ 1 個ぶんの場所しか取らせない。
  // 押したときに実際の入力欄へ切り替える。showPicker() が無い環境
  // （Safari など）でも入力欄自体は見えるので、必ず日付を設定できる。
  function openDateInput() {
    setShowOptions(true)
    setEditingDate(true)
    requestAnimationFrame(() => {
      const input = dateRef.current
      if (!input) return
      input.focus()
      if ('showPicker' in input) {
        try {
          input.showPicker()
        } catch {
          // ユーザー操作と見なされない場合など。フォーカス済みなので入力はできる。
        }
      }
    })
  }

  const expanded = showOptions || canSubmit

  return (
    <form className="todo-form" onSubmit={handleSubmit}>
      <div className="todo-form__row">
        <input
          ref={titleRef}
          className="todo-form__title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setShowOptions(true)}
          placeholder="新しいタスク..."
          aria-label="新しいタスク"
        />
        <button
          type="submit"
          className="todo-form__submit"
          disabled={!canSubmit}
          aria-label="タスクを追加"
        >
          <Icon name="plus" />
        </button>
      </div>

      {expanded && (
        <div className="todo-form__options">
          {editingDate ? (
            <input
              ref={dateRef}
              className="todo-form__date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              onBlur={() => setEditingDate(false)}
              aria-label="期限"
            />
          ) : (
            <button
              type="button"
              className={`chip${dueDate !== '' ? ' is-selected' : ''}`}
              onClick={openDateInput}
            >
              <Icon name="calendar" />
              {dueDate === '' ? '期限' : formatDueLabel(dueDate, today)}
            </button>
          )}

          {dueDate !== '' && (
            <button
              type="button"
              className="chip chip--clear"
              onClick={() => {
                setDueDate('')
                setEditingDate(false)
              }}
              aria-label="期限をクリア"
            >
              <Icon name="close" />
            </button>
          )}

          <span className="todo-form__divider" aria-hidden="true" />

          <button
            type="button"
            className={`chip${categoryId === null ? ' is-selected' : ''}`}
            onClick={() => setCategoryId(null)}
            aria-pressed={categoryId === null}
          >
            未分類
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`chip chip--cat${categoryId === category.id ? ' is-selected' : ''}`}
              data-color={category.color}
              onClick={() => setCategoryId(category.id)}
              aria-pressed={categoryId === category.id}
            >
              <span className="chip__dot" aria-hidden="true" />
              {category.name}
            </button>
          ))}
        </div>
      )}
    </form>
  )
}
