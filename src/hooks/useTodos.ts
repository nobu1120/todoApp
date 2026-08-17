import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { Todo } from '../types'
import { createTodo, todosReducer, type NewTodoInput, type TodoPatch } from '../lib/todos'
import { load, save } from '../lib/storage'

/** 削除の取り消しを出しておく時間。 */
const UNDO_TIMEOUT_MS = 6000

export function useTodos() {
  const [todos, dispatch] = useReducer(todosReducer, undefined, () => load().todos)

  // 直前に削除した Todo。「元に戻す」で丸ごと復元する。
  const [lastRemoved, setLastRemoved] = useState<Todo | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    save(todos)
  }, [todos])

  // アンマウント時にタイマーを止める。
  useEffect(() => () => {
    if (undoTimer.current !== null) clearTimeout(undoTimer.current)
  }, [])

  const clearUndo = useCallback(() => {
    if (undoTimer.current !== null) clearTimeout(undoTimer.current)
    undoTimer.current = null
    setLastRemoved(null)
  }, [])

  const add = useCallback((input: NewTodoInput) => {
    dispatch({ type: 'add', todo: createTodo(input) })
  }, [])

  const update = useCallback((id: string, patch: TodoPatch) => {
    dispatch({ type: 'update', id, patch, now: new Date().toISOString() })
  }, [])

  const toggle = useCallback((id: string) => {
    dispatch({ type: 'toggle', id, now: new Date().toISOString() })
  }, [])

  const remove = useCallback(
    (id: string) => {
      const target = todos.find((todo) => todo.id === id)
      dispatch({ type: 'remove', id })
      if (!target) return

      if (undoTimer.current !== null) clearTimeout(undoTimer.current)
      setLastRemoved(target)
      undoTimer.current = setTimeout(() => {
        undoTimer.current = null
        setLastRemoved(null)
      }, UNDO_TIMEOUT_MS)
    },
    [todos],
  )

  const undoRemove = useCallback(() => {
    if (lastRemoved === null) return
    dispatch({ type: 'add', todo: lastRemoved })
    clearUndo()
  }, [lastRemoved, clearUndo])

  return { todos, add, update, toggle, remove, lastRemoved, undoRemove, clearUndo }
}
