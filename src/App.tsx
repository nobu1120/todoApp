import { useMemo, useState } from 'react'
import type { Filter } from './types'
import { countActive, filterTodos, sortTodos } from './lib/todos'
import { useTodos } from './hooks/useTodos'
import { useToday } from './hooks/useToday'
import { TodoForm } from './components/TodoForm'
import { FilterBar } from './components/FilterBar'
import { TodoList } from './components/TodoList'

const EMPTY_MESSAGE: Record<Filter, string> = {
  all: 'まだタスクがありません。上の欄から追加してください。',
  active: '未完了のタスクはありません。',
  today: '今日が期限のタスクはありません。',
  overdue: '期限切れのタスクはありません。',
  done: '完了したタスクはまだありません。',
}

export default function App() {
  const { todos, add, update, toggle, remove, lastRemoved, undoRemove } = useTodos()
  const [filter, setFilter] = useState<Filter>('all')
  const today = useToday()

  const visible = useMemo(
    () => sortTodos(filterTodos(todos, filter, today)),
    [todos, filter, today],
  )

  const counts = useMemo(
    () => ({
      all: todos.length,
      active: filterTodos(todos, 'active', today).length,
      today: filterTodos(todos, 'today', today).length,
      overdue: filterTodos(todos, 'overdue', today).length,
      done: filterTodos(todos, 'done', today).length,
    }),
    [todos, today],
  )

  return (
    <div className="app">
      <header className="app__header">
        <h1>Todo</h1>
        <p className="app__summary">
          残り {countActive(todos)} / {todos.length}
        </p>
      </header>

      <TodoForm onAdd={add} />

      <FilterBar current={filter} counts={counts} onChange={setFilter} />

      <TodoList
        todos={visible}
        today={today}
        emptyMessage={EMPTY_MESSAGE[filter]}
        onToggle={toggle}
        onUpdate={update}
        onRemove={remove}
      />

      {lastRemoved !== null && (
        <div className="undo" role="status">
          <span className="undo__text">「{lastRemoved.title}」を削除しました</span>
          <button type="button" onClick={undoRemove}>
            元に戻す
          </button>
        </div>
      )}
    </div>
  )
}
