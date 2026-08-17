import type {
  Category,
  Filter,
  Settings,
  StatusFilter,
  Subtask,
  Todo,
  TodoStore,
} from '../types'
import { isOverdue, parseISODate, todayISO } from './date'

export type NewTodoInput = {
  title: string
  dueDate?: string | null
  dueTime?: string | null
  icon?: string
  categoryId?: string | null
}

/** 編集できるフィールドだけを露出する。id や createdAt は書き換えさせない。 */
export type TodoPatch = Partial<
  Pick<Todo, 'title' | 'dueDate' | 'dueTime' | 'icon' | 'categoryId' | 'notes' | 'priority'>
>

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
    dueTime: input.dueTime ?? null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    icon: input.icon ?? '',
    categoryId: input.categoryId ?? null,
    notes: '',
    subtasks: [],
    notifiedAt: null,
    priority: 'normal',
  }
}

export function createSubtask(title: string, id: string = crypto.randomUUID()): Subtask {
  return { id, title: title.trim(), done: false }
}

// --- reducer -----------------------------------------------------------------

export type Action =
  /** 新規追加と、削除の取り消し（保存しておいた Todo をそのまま戻す）の両方に使う。 */
  | { type: 'add'; todo: Todo }
  | { type: 'update'; id: string; patch: TodoPatch; now: string }
  | { type: 'toggle'; id: string; now: string }
  | { type: 'remove'; id: string }
  /** 通知済みとして記録し、同じタスクで二度鳴らないようにする。 */
  | { type: 'markNotified'; ids: string[]; now: string }
  | { type: 'subtask:add'; id: string; subtask: Subtask; now: string }
  | { type: 'subtask:toggle'; id: string; subtaskId: string; now: string }
  | { type: 'subtask:rename'; id: string; subtaskId: string; title: string; now: string }
  | { type: 'subtask:remove'; id: string; subtaskId: string; now: string }
  | { type: 'category:add'; category: Category }
  | { type: 'category:update'; id: string; patch: Partial<Omit<Category, 'id'>> }
  | { type: 'category:remove'; id: string; now: string }
  | { type: 'settings:update'; patch: Partial<Settings> }

/** 指定 id の Todo だけを差し替える。該当しない要素は同一参照のまま残す。 */
function mapTodo(store: TodoStore, id: string, fn: (todo: Todo) => Todo): TodoStore {
  let changed = false
  const todos = store.todos.map((todo) => {
    if (todo.id !== id) return todo
    changed = true
    return fn(todo)
  })
  return changed ? { ...store, todos } : store
}

function mapSubtask(
  store: TodoStore,
  id: string,
  subtaskId: string,
  now: string,
  fn: (subtask: Subtask) => Subtask,
): TodoStore {
  return mapTodo(store, id, (todo) => ({
    ...todo,
    subtasks: todo.subtasks.map((s) => (s.id === subtaskId ? fn(s) : s)),
    updatedAt: now,
  }))
}

export function storeReducer(store: TodoStore, action: Action): TodoStore {
  switch (action.type) {
    case 'add':
      return { ...store, todos: [...store.todos, action.todo] }

    case 'update':
      return mapTodo(store, action.id, (todo) => {
        const patch = { ...action.patch }
        if (patch.title !== undefined) patch.title = patch.title.trim()
        const next = { ...todo, ...patch, updatedAt: action.now }
        // 期限を動かしたら通知はやり直す。
        if (patch.dueDate !== undefined || patch.dueTime !== undefined) next.notifiedAt = null
        return next
      })

    case 'toggle':
      return mapTodo(store, action.id, (todo) => {
        const done = !todo.done
        return {
          ...todo,
          done,
          completedAt: done ? action.now : null,
          updatedAt: action.now,
        }
      })

    case 'remove':
      return { ...store, todos: store.todos.filter((todo) => todo.id !== action.id) }

    case 'markNotified': {
      const ids = new Set(action.ids)
      if (ids.size === 0) return store
      return {
        ...store,
        todos: store.todos.map((todo) =>
          ids.has(todo.id) ? { ...todo, notifiedAt: action.now } : todo,
        ),
      }
    }

    case 'subtask:add':
      return mapTodo(store, action.id, (todo) => ({
        ...todo,
        subtasks: [...todo.subtasks, action.subtask],
        updatedAt: action.now,
      }))

    case 'subtask:toggle':
      return mapSubtask(store, action.id, action.subtaskId, action.now, (s) => ({
        ...s,
        done: !s.done,
      }))

    case 'subtask:rename':
      return mapSubtask(store, action.id, action.subtaskId, action.now, (s) => ({
        ...s,
        title: action.title.trim(),
      }))

    case 'subtask:remove':
      return mapTodo(store, action.id, (todo) => ({
        ...todo,
        subtasks: todo.subtasks.filter((s) => s.id !== action.subtaskId),
        updatedAt: action.now,
      }))

    case 'category:add':
      return { ...store, categories: [...store.categories, action.category] }

    case 'category:update':
      return {
        ...store,
        categories: store.categories.map((c) =>
          c.id === action.id ? { ...c, ...action.patch } : c,
        ),
      }

    case 'category:remove':
      // カテゴリを消したら、参照していたタスクは未分類に落とす（孤児を残さない）。
      return {
        ...store,
        categories: store.categories.filter((c) => c.id !== action.id),
        todos: store.todos.map((todo) =>
          todo.categoryId === action.id
            ? { ...todo, categoryId: null, updatedAt: action.now }
            : todo,
        ),
      }

    case 'settings:update':
      return { ...store, settings: { ...store.settings, ...action.patch } }
  }
}

// --- 進捗 ---------------------------------------------------------------------

export type Progress = { done: number; total: number; ratio: number }

/** サブタスクが 1 つも無ければ null（進捗バーを出さない）。 */
export function progressOf(todo: Todo): Progress | null {
  if (todo.subtasks.length === 0) return null
  const done = todo.subtasks.filter((s) => s.done).length
  return { done, total: todo.subtasks.length, ratio: done / todo.subtasks.length }
}

// --- 通知の判定 ----------------------------------------------------------------

/** 古い期限のタスクが一斉に通知されないよう、通知は期限から 24 時間以内に限る。 */
const NOTIFY_WINDOW_MS = 24 * 60 * 60 * 1000

/** 通知を出すべき時刻。時刻未指定なら設定の既定時刻を使う。 */
export function dueMoment(todo: Todo, settings: Settings): Date | null {
  if (todo.dueDate === null) return null
  return parseISODate(todo.dueDate, todo.dueTime ?? settings.defaultNotifyTime)
}

export function todosToNotify(todos: Todo[], settings: Settings, now: Date): Todo[] {
  return todos.filter((todo) => {
    if (todo.done || todo.notifiedAt !== null) return false
    const moment = dueMoment(todo, settings)
    if (moment === null) return false
    const elapsed = now.getTime() - moment.getTime()
    return elapsed >= 0 && elapsed < NOTIFY_WINDOW_MS
  })
}

// --- 表示用の絞り込み・並び替え ------------------------------------------------

export function matchesStatus(todo: Todo, status: StatusFilter, today: string): boolean {
  switch (status) {
    case 'all':
      return true
    case 'active':
      return !todo.done
    case 'today':
      return !todo.done && todo.dueDate === today
    case 'overdue':
      return !todo.done && isOverdue(todo.dueDate, today)
    case 'done':
      return todo.done
  }
}

export function filterTodos(todos: Todo[], filter: Filter, today: string = todayISO()): Todo[] {
  return todos.filter(
    (todo) =>
      matchesStatus(todo, filter.status, today) &&
      (filter.categoryId === null || todo.categoryId === filter.categoryId),
  )
}

/**
 * 未完了が上 → 期限が近い順（期限なしは末尾）→ 作成が新しい順。
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

/** 画面上部のリマインドに出す、対応が要るタスク。 */
export function needsAttention(
  todos: Todo[],
  today: string = todayISO(),
): { overdue: Todo[]; today: Todo[] } {
  return {
    overdue: sortTodos(todos.filter((t) => !t.done && isOverdue(t.dueDate, today))),
    today: sortTodos(todos.filter((t) => !t.done && t.dueDate === today)),
  }
}
