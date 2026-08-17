import type { Todo } from '../types'
import type { TodoPatch } from '../lib/todos'
import { TodoItem } from './TodoItem'

type Props = {
  todos: Todo[]
  today: string
  emptyMessage: string
  onToggle: (id: string) => void
  onUpdate: (id: string, patch: TodoPatch) => void
  onRemove: (id: string) => void
}

export function TodoList({ todos, today, emptyMessage, onToggle, onUpdate, onRemove }: Props) {
  if (todos.length === 0) {
    return <p className="empty">{emptyMessage}</p>
  }

  return (
    <ul className="todo-list">
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          today={today}
          onToggle={onToggle}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      ))}
    </ul>
  )
}
