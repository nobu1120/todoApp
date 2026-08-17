import type { Category, Todo } from '../types'
import { TodoItem } from './TodoItem'

type Props = {
  todos: Todo[]
  categories: Category[]
  today: string
  /** 選択モード。中では行をタップ＝選択になり、詳細は開かない。 */
  selecting?: boolean
  selectedIds?: Set<string>
  onToggle: (id: string) => void
  onOpen: (id: string) => void
  onRemove: (id: string) => void
  onSelect?: (id: string) => void
}

export function TodoList({
  todos,
  categories,
  today,
  selecting = false,
  selectedIds,
  onToggle,
  onOpen,
  onRemove,
  onSelect,
}: Props) {
  return (
    <ul className="todo-list">
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          categories={categories}
          today={today}
          selecting={selecting}
          selected={selectedIds?.has(todo.id) ?? false}
          onToggle={onToggle}
          onOpen={onOpen}
          onRemove={onRemove}
          onSelect={onSelect}
        />
      ))}
    </ul>
  )
}
