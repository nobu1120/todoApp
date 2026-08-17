import type { Category, Todo } from '../types'
import { TodoItem } from './TodoItem'

type Props = {
  todos: Todo[]
  categories: Category[]
  today: string
  onToggle: (id: string) => void
  onOpen: (id: string) => void
  onRemove: (id: string) => void
}

export function TodoList({ todos, categories, today, onToggle, onOpen, onRemove }: Props) {
  return (
    <ul className="todo-list">
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          categories={categories}
          today={today}
          onToggle={onToggle}
          onOpen={onOpen}
          onRemove={onRemove}
        />
      ))}
    </ul>
  )
}
