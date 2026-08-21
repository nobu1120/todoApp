import { useCallback, useState } from 'react'
import type { Category, Todo } from '../types'
import { TodoItem } from './TodoItem'
import { useLongPressDrag } from '../hooks/useLongPressDrag'

type Props = {
  todos: Todo[]
  categories: Category[]
  today: string
  /** 選択モード。中では行をタップ＝選択になり、詳細は開かない。 */
  selecting?: boolean
  selectedIds?: Set<string>
  onToggle: (id: string) => void
  /** 渡すと、一覧の中でサブタスクを直接チェックできる。 */
  onToggleSubtask?: (id: string, subtaskId: string) => void
  onOpen: (id: string) => void
  onRemove: (id: string) => void
  onSelect?: (id: string) => void
  /** 長押しして動かしたとき。before の直前に入れる（null は末尾）。 */
  onReorder?: (id: string, before: string | null) => void
  /** 長押しして動かさずに離したとき。 */
  onHold?: (id: string) => void
}

export function TodoList({
  todos,
  categories,
  today,
  selecting = false,
  selectedIds,
  onToggle,
  onToggleSubtask,
  onOpen,
  onRemove,
  onSelect,
  onReorder,
  onHold,
}: Props) {
  /*
   * 畳んでいるタスクの id。既定は開いた状態なので、持つのは「畳んだほう」。
   *
   * ストアには入れない。どこまで開いているかは今この画面での都合で、
   * 端末をまたいで揃える意味がないため（同期の対象を増やしたくない）。
   */
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  const toggleCollapsed = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }, [])

  const press = useLongPressDrag({
    onDrop: (id, before) => onReorder?.(id, before),
    onHold: (id) => onHold?.(id),
    // 並べ替えを受け取らない一覧（カレンダーの日別など）では動かさない。
    disabled: selecting || onReorder === undefined,
  })

  return (
    <ul
      className={`todo-list${press.drag.id !== null ? ' is-dragging' : ''}`}
      ref={press.listRef}
      onTouchEnd={press.onPointerUp}
      onTouchCancel={press.cancel}
    >
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          categories={categories}
          today={today}
          selecting={selecting}
          selected={selectedIds?.has(todo.id) ?? false}
          held={press.drag.id === todo.id}
          dropBefore={press.drag.id !== null && press.drag.before === todo.id}
          collapsed={collapsed.has(todo.id)}
          onPressStart={press.onPointerDown}
          onToggle={onToggle}
          onToggleSubtask={onToggleSubtask}
          onToggleCollapsed={toggleCollapsed}
          onOpen={onOpen}
          onRemove={onRemove}
          onSelect={onSelect}
        />
      ))}
      {/* 末尾に落とすための受け皿。行の下に指があるときの目印。 */}
      {press.drag.id !== null && press.drag.before === null && (
        <li className="todo-list__drop-end" aria-hidden="true" />
      )}
    </ul>
  )
}
