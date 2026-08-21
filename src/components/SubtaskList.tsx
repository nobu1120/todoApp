import { useState, type FormEvent } from 'react'
import type { Subtask } from '../types'
import { Icon } from './Icon'

type Props = {
  subtasks: Subtask[]
  onAdd: (title: string) => void
  onToggle: (subtaskId: string) => void
  onRename: (subtaskId: string, title: string) => void
  onSetDue: (subtaskId: string, dueDate: string | null) => void
  onRemove: (subtaskId: string) => void
  /** 親の期限。サブタスクの日付欄の上限にする。 */
  parentDue: string | null
}

export function SubtaskList({
  subtasks,
  onAdd,
  onToggle,
  onRename,
  onSetDue,
  onRemove,
  parentDue,
}: Props) {
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
            {/*
              * 親より後の日付は選べないようにする。
              * 「親の締切より後に片付ける下準備」は意味を成さないので、
              * 入れられてから直させるより、そもそも選べないほうがいい。
              */}
            <input
              className={`subtask__due${subtask.dueDate === null ? ' is-empty' : ''}`}
              type="date"
              value={subtask.dueDate ?? ''}
              max={parentDue ?? undefined}
              onChange={(e) => onSetDue(subtask.id, e.target.value === '' ? null : e.target.value)}
              aria-label={`${subtask.title} の期限`}
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
