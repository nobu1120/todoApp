import { useMemo } from 'react'
import type { Category, Todo } from '../types'
import type { NewTodoInput } from '../lib/todos'
import {
  countByDate,
  formatDayLabel,
  todosOnDate,
  undatedCount,
  type YearMonth,
} from '../lib/calendar'
import { Calendar } from './Calendar'
import { TodoList } from './TodoList'
import { TodoForm } from './TodoForm'

type Props = {
  todos: Todo[]
  categories: Category[]
  today: string
  month: YearMonth
  selected: string
  onChangeMonth: (next: YearMonth) => void
  onSelect: (date: string) => void
  onAdd: (input: NewTodoInput) => void
  onToggle: (id: string) => void
  onOpen: (id: string) => void
  onRemove: (id: string) => void
}

/** 上半分にカレンダー、下半分に選んだ日の予定。 */
export function CalendarView({
  todos,
  categories,
  today,
  month,
  selected,
  onChangeMonth,
  onSelect,
  onAdd,
  onToggle,
  onOpen,
  onRemove,
}: Props) {
  const counts = useMemo(() => countByDate(todos), [todos])
  const dayTodos = useMemo(() => todosOnDate(todos, selected), [todos, selected])
  const undated = useMemo(() => undatedCount(todos), [todos])
  const pending = dayTodos.filter((t) => !t.done).length

  return (
    <div className="calendar-view">
      <Calendar
        month={month}
        selected={selected}
        today={today}
        counts={counts}
        onChangeMonth={onChangeMonth}
        onSelect={onSelect}
      />

      <div className="day">
        <div className="day__head">
          <h2 className="day__title">
            {formatDayLabel(selected)}
            {selected === today && <span className="day__badge">今日</span>}
          </h2>
          <span className="day__count">
            {pending > 0 ? `残り ${pending} 件` : dayTodos.length > 0 ? '完了' : '予定なし'}
          </span>
        </div>

        <div className="day__body">
          {dayTodos.length === 0 ? (
            <p className="day__empty">この日の予定はありません。</p>
          ) : (
            <TodoList
              todos={dayTodos}
              categories={categories}
              today={today}
              onToggle={onToggle}
              onOpen={onOpen}
              onRemove={onRemove}
            />
          )}
        </div>

        {/* 見ている日にそのまま足せるよう、期限を選んだ日で埋めておく。 */}
        <TodoForm
          categories={categories}
          today={today}
          defaultCategoryId={null}
          fixedDueDate={selected}
          onAdd={onAdd}
        />

        {undated > 0 && (
          <p className="day__undated">
            期限のないタスクが {undated} 件あります（リスト表示で見られます）。
          </p>
        )}
      </div>
    </div>
  )
}
