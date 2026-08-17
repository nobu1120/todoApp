import { useState, type FormEvent } from 'react'
import type { Subtask } from '../types'
import { Icon } from './Icon'

type Props = {
  subtasks: Subtask[]
  onAdd: (title: string) => void
  onToggle: (subtaskId: string) => void
  onRename: (subtaskId: string, title: string) => void
  onRemove: (subtaskId: string) => void
}

export function SubtaskList({ subtasks, onAdd, onToggle, onRename, onRemove }: Props) {
  const [draft, setDraft] = useState('')

  function handleAdd(event: FormEvent) {
    event.preventDefault()
    if (draft.trim() === '') return
    onAdd(draft)
    setDraft('')
  }

  return (
    <div className="subtasks">
      <ul className="subtasks__list">
        {subtasks.map((subtask) => (
          <li key={subtask.id} className="subtask">
            <label className="subtask__check">
              <input
                className="check check--sm"
                type="checkbox"
                checked={subtask.done}
                onChange={() => onToggle(subtask.id)}
                aria-label={`${subtask.title} を${subtask.done ? '未完了に戻す' : '完了にする'}`}
              />
            </label>
            <input
              className={`subtask__title${subtask.done ? ' is-done' : ''}`}
              value={subtask.title}
              onChange={(e) => onRename(subtask.id, e.target.value)}
              aria-label="サブタスク名"
            />
            <button
              type="button"
              className="icon-button subtask__remove"
              onClick={() => onRemove(subtask.id)}
              aria-label={`${subtask.title} を削除`}
            >
              <Icon name="close" />
            </button>
          </li>
        ))}
      </ul>

      <form className="subtasks__add" onSubmit={handleAdd}>
        <span className="subtasks__add-icon" aria-hidden="true">
          <Icon name="plus" />
        </span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="サブタスクを追加"
          aria-label="サブタスクを追加"
        />
        {draft.trim() !== '' && <button type="submit">追加</button>}
      </form>
    </div>
  )
}
