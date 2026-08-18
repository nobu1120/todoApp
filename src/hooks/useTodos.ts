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
import { STORAGE_KEY, load, migrate, save } from '../lib/storage'
import { archiveOld, newId } from '../lib/todos'
import { mergeBackup } from '../lib/backup'
import { todayISO } from '../lib/date'

/** 削除の取り消しを出しておく時間。 */
const UNDO_TIMEOUT_MS = 6000

export function useTodos() {
  // 起動時に一度だけ、古い完了タスクを掃除する。
  const [store, dispatch] = useReducer(storeReducer, undefined, () =>
    archiveOld(load(), new Date().toISOString()),
  )

  // 直前に削除した Todo。「元に戻す」で丸ごと復元する。
  const [lastRemoved, setLastRemoved] = useState<Todo | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    save(store)
  }, [store])

  /*
   * 別のタブでの変更を取り込む。
   * タブごとに独立した状態を持っているため、これが無いと後から保存した
   * タブが前のタブの内容を丸ごと上書きし、片方で足したタスクが消える。
   */
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || event.newValue === null) return
      try {
        dispatch({ type: 'sync:replace', store: migrate(JSON.parse(event.newValue)) })
      } catch {
        // 読めない内容なら、いまの状態のままにしておく。
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => () => {
    if (undoTimer.current !== null) clearTimeout(undoTimer.current)
  }, [])

  const now = () => new Date().toISOString()

  const actions = useMemo(
    () => ({
      add: (input: NewTodoInput) => dispatch({ type: 'add', todo: createTodo(input) }),
      update: (id: string, patch: TodoPatch) =>
        dispatch({ type: 'update', id, patch, now: now() }),
      // 繰り返しタスクの次回ぶんを作れるよう、id と今日をあらかじめ渡す。
      toggle: (id: string) =>
        dispatch({
          type: 'toggle',
          id,
          now: now(),
          nextId: newId(),
          today: todayISO(),
        }),

      bulkToggle: (ids: string[], done: boolean) =>
        dispatch({
          type: 'bulk:toggle',
          ids,
          done,
          now: now(),
          // 繰り返しタスクが混ざっていても次回を作れるよう、人数ぶん用意する。
          nextIds: ids.map(() => newId()),
          today: todayISO(),
        }),
      bulkDue: (ids: string[], dueDate: string | null) =>
        dispatch({ type: 'bulk:due', ids, dueDate, now: now() }),
      bulkRemove: (ids: string[]) => dispatch({ type: 'bulk:remove', ids, now: now() }),
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
      updateCategory: (id: string, patch: Partial<Omit<Category, 'id' | 'updatedAt'>>) =>
        dispatch({ type: 'category:update', id, patch, now: now() }),
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

  /** 書き出しファイルを取り込む。追加した件数を返す。 */
  const importStore = useCallback(
    (incoming: TodoStore) => {
      const before = store.todos.length
      const merged = mergeBackup(store, incoming)
      dispatch({ type: 'sync:replace', store: merged })
      return merged.todos.length - before
    },
    [store],
  )

  const undoRemove = useCallback(() => {
    if (lastRemoved === null) return
    dispatch({ type: 'add', todo: lastRemoved })
    clearUndo()
  }, [lastRemoved, clearUndo])

  return { store, ...actions, remove, importStore, lastRemoved, undoRemove, clearUndo }
}
