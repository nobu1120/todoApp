import { useRef, useState, type FormEvent } from 'react'
import type { NewTodoInput } from '../lib/todos'

type Props = {
  onAdd: (input: NewTodoInput) => void
}

export function TodoForm({ onAdd }: Props) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (title.trim() === '') return

    onAdd({ title, dueDate: dueDate === '' ? null : dueDate })
    setTitle('')
    setDueDate('')
    // 続けて入力できるようにフォーカスを戻す。
    titleRef.current?.focus()
  }

  return (
    <form className="todo-form" onSubmit={handleSubmit}>
      <input
        ref={titleRef}
        className="todo-form__title"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="新しいタスク..."
        aria-label="新しいタスク"
        autoFocus
      />
      <input
        className="todo-form__due"
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        aria-label="期限"
      />
      <button type="submit" disabled={title.trim() === ''} aria-label="追加">
        追加
      </button>
    </form>
  )
}
