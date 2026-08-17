import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { Category, CategoryColor, Settings, Todo, TodoStore } from '../types'
import {
  createSubtask,
  createTodo,
  storeReducer,
  type NewTodoInput,
  type TodoPatch,
} from '../lib/todos'
import { createCategory } from '../lib/categories'
import { load, save } from '../lib/storage'

/** 削除の取り消しを出しておく時間。 */
const UNDO_TIMEOUT_MS = 6000

export function useTodos() {
  const [store, dispatch] = useReducer(storeReducer, undefined, load)

  // 直前に削除した Todo。「元に戻す」で丸ごと復元する。
  const [lastRemoved, setLastRemoved] = useState<Todo | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    save(store)
  }, [store])

  useEffect(() => () => {
    if (undoTimer.current !== null) clearTimeout(undoTimer.current)
  }, [])

  const now = () => new Date().toISOString()

  const actions = useMemo(
    () => ({
      add: (input: NewTodoInput) => dispatch({ type: 'add', todo: createTodo(input) }),
      update: (id: string, patch: TodoPatch) =>
        dispatch({ type: 'update', id, patch, now: now() }),
      toggle: (id: string) => dispatch({ type: 'toggle', id, now: now() }),
      markNotified: (ids: string[]) => dispatch({ type: 'markNotified', ids, now: now() }),

      addSubtask: (id: string, title: string) =>
        dispatch({ type: 'subtask:add', id, subtask: createSubtask(title), now: now() }),
      toggleSubtask: (id: string, subtaskId: string) =>
        dispatch({ type: 'subtask:toggle', id, subtaskId, now: now() }),
      renameSubtask: (id: string, subtaskId: string, title: string) =>
        dispatch({ type: 'subtask:rename', id, subtaskId, title, now: now() }),
      removeSubtask: (id: string, subtaskId: string) =>
        dispatch({ type: 'subtask:remove', id, subtaskId, now: now() }),

      addCategory: (name: string, color: CategoryColor) =>
        dispatch({ type: 'category:add', category: createCategory(name, color) }),
      updateCategory: (id: string, patch: Partial<Omit<Category, 'id'>>) =>
        dispatch({ type: 'category:update', id, patch }),
      removeCategory: (id: string) => dispatch({ type: 'category:remove', id, now: now() }),

      updateSettings: (patch: Partial<Settings>) =>
        dispatch({ type: 'settings:update', patch, now: now() }),

      /** 同期で作った状態をそのまま採用する。 */
      replaceStore: (next: TodoStore) => dispatch({ type: 'sync:replace', store: next }),
    }),
    [],
  )

  const clearUndo = useCallback(() => {
    if (undoTimer.current !== null) clearTimeout(undoTimer.current)
    undoTimer.current = null
    setLastRemoved(null)
  }, [])

  const remove = useCallback(
    (id: string) => {
      const target = store.todos.find((todo) => todo.id === id)
      dispatch({ type: 'remove', id, now: now() })
      if (!target) return

      if (undoTimer.current !== null) clearTimeout(undoTimer.current)
      setLastRemoved(target)
      undoTimer.current = setTimeout(() => {
        undoTimer.current = null
        setLastRemoved(null)
      }, UNDO_TIMEOUT_MS)
    },
    [store.todos],
  )

  const undoRemove = useCallback(() => {
    if (lastRemoved === null) return
    dispatch({ type: 'add', todo: lastRemoved })
    clearUndo()
  }, [lastRemoved, clearUndo])

  return { store, ...actions, remove, lastRemoved, undoRemove, clearUndo }
}
