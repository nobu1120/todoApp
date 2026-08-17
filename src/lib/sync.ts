import type { Category, Settings, Todo, TodoStore, Tombstone } from '../types'
import { COLOR_KEYS, DEFAULT_CATEGORIES } from './categories'
import type { CategoryColor } from '../types'

/**
 * 端末をまたいだ同期。利用者は 1 人なので、衝突は
 * 「更新時刻が新しいほうを採る」（last-write-wins）で解決する。
 * 削除は墓標で伝える。物理削除だけだと、古い端末から同期したときに復活してしまう。
 */

export type RemoteTodo = {
  id: string
  user_id: string
  title: string
  done: boolean
  due_date: string | null
  due_time: string | null
  icon: string
  category_id: string | null
  notes: string
  subtasks: unknown
  priority: string
  notified_at: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  deleted_at: string | null
}

export type RemoteCategory = {
  id: string
  user_id: string
  name: string
  color: string
  updated_at: string
  deleted_at: string | null
}

export type RemoteSettings = {
  user_id: string
  notifications_enabled: boolean
  default_notify_time: string
  time_zone: string
  updated_at: string
}

/** 'HH:MM:SS' で返ってくることがあるので 'HH:MM' に詰める。 */
const shortTime = (t: string | null): string | null => (t === null ? null : t.slice(0, 5))

// --- ローカル → サーバー ------------------------------------------------------

export function toRemoteTodo(todo: Todo, userId: string): RemoteTodo {
  return {
    id: todo.id,
    user_id: userId,
    title: todo.title,
    done: todo.done,
    due_date: todo.dueDate,
    due_time: todo.dueTime,
    icon: todo.icon,
    category_id: todo.categoryId,
    notes: todo.notes,
    subtasks: todo.subtasks,
    priority: todo.priority,
    notified_at: todo.notifiedAt,
    created_at: todo.createdAt,
    updated_at: todo.updatedAt,
    completed_at: todo.completedAt,
    deleted_at: null,
  }
}

export function toRemoteCategory(category: Category, userId: string, updatedAt: string) {
  return {
    id: category.id,
    user_id: userId,
    name: category.name,
    color: category.color,
    updated_at: updatedAt,
    deleted_at: null,
  }
}

export function toRemoteSettings(
  settings: Settings,
  userId: string,
  timeZone: string,
  updatedAt: string,
): RemoteSettings {
  return {
    user_id: userId,
    notifications_enabled: settings.notificationsEnabled,
    default_notify_time: settings.defaultNotifyTime,
    time_zone: timeZone,
    updated_at: updatedAt,
  }
}

// --- サーバー → ローカル ------------------------------------------------------

export function fromRemoteTodo(row: RemoteTodo): Todo {
  const subtasks = Array.isArray(row.subtasks)
    ? row.subtasks.flatMap((s) => {
        if (typeof s !== 'object' || s === null) return []
        const raw = s as Record<string, unknown>
        if (typeof raw.id !== 'string' || typeof raw.title !== 'string') return []
        return [{ id: raw.id, title: raw.title, done: raw.done === true }]
      })
    : []

  return {
    id: row.id,
    title: row.title,
    done: row.done,
    dueDate: row.due_date,
    dueTime: shortTime(row.due_time),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    icon: row.icon,
    categoryId: row.category_id,
    notes: row.notes,
    subtasks,
    notifiedAt: row.notified_at,
    priority:
      row.priority === 'high' || row.priority === 'low' ? row.priority : 'normal',
  }
}

export function fromRemoteCategory(row: RemoteCategory): Category {
  return {
    id: row.id,
    name: row.name,
    color: COLOR_KEYS.includes(row.color as CategoryColor)
      ? (row.color as CategoryColor)
      : 'gray',
  }
}

// --- 突き合わせ ---------------------------------------------------------------

const newer = (a: string, b: string) => (a >= b ? a : b)

export type MergeResult = {
  store: TodoStore
  /** サーバーへ送り直すべきもの（ローカルのほうが新しい、または未登録） */
  pushTodos: Todo[]
  pushCategories: Category[]
  /** サーバー側にも消したと伝えるべき id */
  pushDeletedTodoIds: string[]
  pushDeletedCategoryIds: string[]
}

type RemoteSnapshot = {
  todos: RemoteTodo[]
  categories: RemoteCategory[]
  settings: RemoteSettings | null
}

/**
 * ローカルとサーバーを突き合わせて、採用する状態と送り返すぶんを決める。
 *
 * - 双方にある → updated_at が新しいほうを採る
 * - サーバーだけにある → 取り込む（相手の端末で追加されたもの）
 * - ローカルだけにある → 送る（このデバイスで追加されたもの）
 * - どちらかで消えている → 消えたほうが新しければ削除を優先する
 */
export function mergeStore(local: TodoStore, remote: RemoteSnapshot): MergeResult {
  const tombstoneById = new Map(local.tombstones.map((t) => [t.id, t]))

  // ---- タスク ----
  const localTodos = new Map(local.todos.map((t) => [t.id, t]))
  const mergedTodos = new Map<string, Todo>()
  const pushTodos: Todo[] = []
  const pushDeletedTodoIds: string[] = []
  const seen = new Set<string>()

  for (const row of remote.todos) {
    seen.add(row.id)
    const mine = localTodos.get(row.id)
    const grave = tombstoneById.get(row.id)

    if (row.deleted_at !== null) {
      // サーバーで消えている。こちらが後から復活させていない限り、消えたままにする。
      if (mine !== undefined && mine.updatedAt > row.deleted_at) {
        mergedTodos.set(row.id, mine)
        pushTodos.push(mine)
      }
      continue
    }

    if (grave !== undefined && grave.deletedAt > row.updated_at) {
      // こちらで消したほうが新しい。サーバーにも消したと伝える。
      pushDeletedTodoIds.push(row.id)
      continue
    }

    const theirs = fromRemoteTodo(row)
    if (mine === undefined) {
      mergedTodos.set(row.id, theirs)
    } else if (mine.updatedAt > theirs.updatedAt) {
      mergedTodos.set(row.id, mine)
      pushTodos.push(mine)
    } else {
      mergedTodos.set(row.id, theirs)
    }
  }

  for (const todo of local.todos) {
    if (seen.has(todo.id)) continue
    // サーバーが知らない = この端末で追加された。
    mergedTodos.set(todo.id, todo)
    pushTodos.push(todo)
  }

  // ---- カテゴリ ----
  const mergedCategories = new Map<string, Category>()
  const pushCategories: Category[] = []
  const pushDeletedCategoryIds: string[] = []
  const seenCategories = new Set<string>()

  for (const row of remote.categories) {
    seenCategories.add(row.id)
    const grave = tombstoneById.get(row.id)

    if (row.deleted_at !== null) continue

    if (grave !== undefined && grave.deletedAt > row.updated_at) {
      pushDeletedCategoryIds.push(row.id)
      continue
    }
    mergedCategories.set(row.id, fromRemoteCategory(row))
  }

  for (const category of local.categories) {
    if (seenCategories.has(category.id)) continue
    mergedCategories.set(category.id, category)
    pushCategories.push(category)
  }

  // ---- 設定 ----
  // サーバー側に記録が無ければローカルを採る。あれば新しいほうを採る。
  const settings: Settings =
    remote.settings === null
      ? local.settings
      : {
          notificationsEnabled: remote.settings.notifications_enabled,
          defaultNotifyTime: remote.settings.default_notify_time.slice(0, 5),
        }

  // 消えたカテゴリを指したままのタスクを未分類に落とす。
  const categoryIds = new Set(mergedCategories.keys())
  const todos = [...mergedTodos.values()].map((todo) =>
    todo.categoryId !== null && !categoryIds.has(todo.categoryId)
      ? { ...todo, categoryId: null }
      : todo,
  )

  return {
    store: {
      schemaVersion: 3,
      todos,
      categories: [...mergedCategories.values()],
      settings,
      tombstones: local.tombstones,
    },
    pushTodos,
    pushCategories,
    pushDeletedTodoIds,
    pushDeletedCategoryIds,
  }
}

/** 初回同期で、サーバーが空なら既定カテゴリを送っておく。 */
export function categoriesToSeed(local: TodoStore): Category[] {
  return local.categories.length > 0 ? local.categories : DEFAULT_CATEGORIES
}

/** ローカルのほうが新しい行だけを選ぶ。毎回全件送らないため。 */
export function changedSince<T extends { updatedAt: string }>(rows: T[], since: string): T[] {
  return rows.filter((row) => row.updatedAt > since)
}

export function tombstonesSince(tombstones: Tombstone[], since: string): Tombstone[] {
  return tombstones.filter((t) => t.deletedAt > since)
}

export { newer }
