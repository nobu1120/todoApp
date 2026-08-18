import { useRef, useState, type FormEvent } from 'react'
import type { Category } from '../types'
import type { NewTodoInput } from '../lib/todos'
import { formatDueLabel } from '../lib/date'
import { parseInput } from '../lib/parseInput'
import { Icon } from './Icon'

type Props = {
  categories: Category[]
  today: string
  /** カテゴリで絞り込み中なら、それを初期カテゴリにする。 */
  defaultCategoryId: string | null
  /** 期限を固定する（カレンダーで選んだ日に足すとき）。指定時は期限の選択欄を出さない。 */
  fixedDueDate?: string
  onAdd: (input: NewTodoInput) => void
}

export function TodoForm({ categories, today, defaultCategoryId, fixedDueDate, onAdd }: Props) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(defaultCategoryId)
  const [showOptions, setShowOptions] = useState(false)
  const [editingDate, setEditingDate] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)

  const canSubmit = title.trim() !== ''

  /*
   * 打ちながら「何と読んだか」を出す。
   * 黙って期限が付くと、間違って読まれたときに気づけない。
   */
  const parsed = parseInput(title, today, categories)
  const understood =
    parsed.dueDate !== null || parsed.categoryId !== null ||
    parsed.priority !== 'normal' || parsed.repeat !== 'none'

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return

    // 欄で明示した指定は、書き取った内容より優先する。
    onAdd({
      title: parsed.title,
      dueDate: fixedDueDate ?? (dueDate !== '' ? dueDate : parsed.dueDate),
      dueTime: parsed.dueTime,
      categoryId: categoryId ?? parsed.categoryId,
      priority: parsed.priority,
      repeat: parsed.repeat,
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
          placeholder={fixedDueDate === undefined ? '新しいタスク...' : 'この日にタスクを追加...'}
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

      {understood && (
        <p className="todo-form__read" role="status">
          <Icon name="check" />
          <span>
            {parsed.dueDate !== null && (
              <b>{formatDueLabel(parsed.dueDate, today)}</b>
            )}
            {parsed.dueTime !== null && <b>{parsed.dueTime}</b>}
            {parsed.repeat !== 'none' && (
              <b>{parsed.repeat === 'daily' ? '毎日' : parsed.repeat === 'weekly' ? '毎週' : '毎月'}</b>
            )}
            {parsed.categoryId !== null && (
              <b>{categories.find((c) => c.id === parsed.categoryId)?.name}</b>
            )}
            {parsed.priority !== 'normal' && <b>{parsed.priority === 'high' ? '高' : '低'}</b>}
            <span className="todo-form__read-title">{parsed.title}</span>
          </span>
        </p>
      )}

      {expanded && (
        <div className="todo-form__options">
          {fixedDueDate !== undefined ? null : editingDate ? (
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

          {fixedDueDate === undefined && dueDate !== '' && (
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

          {fixedDueDate === undefined && <span className="todo-form__divider" aria-hidden="true" />}

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
