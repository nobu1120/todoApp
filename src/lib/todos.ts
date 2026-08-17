import type { Filter, Todo } from '../types'
import { isOverdue, todayISO } from './date'

export type NewTodoInput = {
  title: string
  dueDate?: string | null
}

/** 編集できるフィールドだけを露出する。id や createdAt は書き換えさせない。 */
export type TodoPatch = Partial<Pick<Todo, 'title' | 'dueDate' | 'priority' | 'tags' | 'notes'>>

export function createTodo(
  input: NewTodoInput,
  now: string = new Date().toISOString(),
  id: string = crypto.randomUUID(),
): Todo {
  return {
    id,
    title: input.title.trim(),
    done: false,
    dueDate: input.dueDate ?? null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    priority: 'normal',
    tags: [],
    notes: '',
  }
}

// --- reducer -----------------------------------------------------------------

export type Action =
  /** 新規追加と、削除の取り消し（保存しておいた Todo をそのまま戻す）の両方に使う。 */
  | { type: 'add'; todo: Todo }
  | { type: 'update'; id: string; patch: TodoPatch; now: string }
  | { type: 'toggle'; id: string; now: string }
  | { type: 'remove'; id: string }

export function todosReducer(todos: Todo[], action: Action): Todo[] {
  switch (action.type) {
    case 'add':
      return [...todos, action.todo]

    case 'update':
      return todos.map((todo) => {
        if (todo.id !== action.id) return todo
        const patch = { ...action.patch }
        if (patch.title !== undefined) patch.title = patch.title.trim()
        return { ...todo, ...patch, updatedAt: action.now }
      })

    case 'toggle':
      return todos.map((todo) => {
        if (todo.id !== action.id) return todo
        const done = !todo.done
        return {
          ...todo,
          done,
          completedAt: done ? action.now : null,
          updatedAt: action.now,
        }
      })

    case 'remove':
      return todos.filter((todo) => todo.id !== action.id)
  }
}

// --- 表示用の絞り込み・並び替え ------------------------------------------------

export function filterTodos(todos: Todo[], filter: Filter, today: string = todayISO()): Todo[] {
  switch (filter) {
    case 'all':
      return todos
    case 'active':
      return todos.filter((todo) => !todo.done)
    case 'today':
      return todos.filter((todo) => !todo.done && todo.dueDate === today)
    case 'overdue':
      return todos.filter((todo) => !todo.done && isOverdue(todo.dueDate, today))
    case 'done':
      return todos.filter((todo) => todo.done)
  }
}

/**
 * 未完了が上 → 期限が近い順（期限なしは末尾） → 作成が新しい順。
 * 元配列は変更しない。
 */
export function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1

    if (a.dueDate !== b.dueDate) {
      if (a.dueDate === null) return 1
      if (b.dueDate === null) return -1
      return a.dueDate < b.dueDate ? -1 : 1
    }

    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1
    return 0
  })
}

export function countActive(todos: Todo[]): number {
  return todos.filter((todo) => !todo.done).length
}
