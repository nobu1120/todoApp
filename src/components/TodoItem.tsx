import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { Todo } from '../types'
import type { TodoPatch } from '../lib/todos'
import { formatDueLabel, isOverdue, isToday } from '../lib/date'

type Props = {
  todo: Todo
  today: string
  onToggle: (id: string) => void
  onUpdate: (id: string, patch: TodoPatch) => void
  onRemove: (id: string) => void
}

export function TodoItem({ todo, today, onToggle, onUpdate, onRemove }: Props) {
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(todo.title)
  const [draftDue, setDraftDue] = useState(todo.dueDate ?? '')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) titleRef.current?.select()
  }, [editing])

  function startEditing() {
    setDraftTitle(todo.title)
    setDraftDue(todo.dueDate ?? '')
    setEditing(true)
  }

  function commit(event?: FormEvent) {
    event?.preventDefault()
    // 空タイトルは保存せず、編集前の内容に戻す。
    if (draftTitle.trim() === '') {
      setEditing(false)
      return
    }
    onUpdate(todo.id, {
      title: draftTitle,
      dueDate: draftDue === '' ? null : draftDue,
    })
    setEditing(false)
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <li className="todo-item todo-item--editing">
        <form className="todo-item__edit" onSubmit={commit} onKeyDown={handleKeyDown}>
          <input
            ref={titleRef}
            className="todo-item__edit-title"
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            aria-label="タイトルを編集"
          />
          <input
            className="todo-item__edit-due"
            type="date"
            value={draftDue}
            onChange={(e) => setDraftDue(e.target.value)}
            aria-label="期限を編集"
          />
          <button type="submit">保存</button>
          <button type="button" className="ghost" onClick={() => setEditing(false)}>
            取消
          </button>
        </form>
      </li>
    )
  }

  const overdue = isOverdue(todo.dueDate, today)
  const dueToday = isToday(todo.dueDate, today)

  return (
    <li className={`todo-item${todo.done ? ' todo-item--done' : ''}`}>
      <input
        className="todo-item__check"
        type="checkbox"
        checked={todo.done}
        onChange={() => onToggle(todo.id)}
        aria-label={`${todo.title} を${todo.done ? '未完了に戻す' : '完了にする'}`}
      />

      <button type="button" className="todo-item__title" onClick={startEditing} title="クリックで編集">
        {todo.title}
      </button>

      {todo.dueDate !== null && (
        <span
          className={
            'todo-item__due' +
            (!todo.done && overdue ? ' todo-item__due--overdue' : '') +
            (!todo.done && dueToday ? ' todo-item__due--today' : '')
          }
        >
          {formatDueLabel(todo.dueDate, today)}
          {!todo.done && overdue && <span aria-label="期限切れ"> ⚠</span>}
        </span>
      )}

      <button
        type="button"
        className="todo-item__remove"
        onClick={() => onRemove(todo.id)}
        aria-label={`${todo.title} を削除`}
      >
        ×
      </button>
    </li>
  )
}
