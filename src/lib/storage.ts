import type { Priority, Todo, TodoStore } from '../types'

const STORAGE_KEY = 'todoApp.store'
const CURRENT_VERSION = 1

export const emptyStore: TodoStore = { schemaVersion: CURRENT_VERSION, todos: [] }

const PRIORITIES: Priority[] = ['high', 'normal', 'low']

/**
 * localStorage の中身は「外から書き換えられうる、信用できない JSON」として扱う。
 * 1件ずつ検証し、壊れている行だけ捨てる（全体を捨てない）。
 */
function parseTodo(value: unknown): Todo | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>

  if (typeof raw.id !== 'string' || raw.id === '') return null
  if (typeof raw.title !== 'string') return null

  const dueDate =
    typeof raw.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.dueDate) ? raw.dueDate : null
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString()
  const done = raw.done === true

  return {
    id: raw.id,
    title: raw.title,
    done,
    dueDate,
    createdAt,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt,
    completedAt: done && typeof raw.completedAt === 'string' ? raw.completedAt : null,
    // 第2弾用フィールド。まだ存在しない古いデータは既定値で埋める。
    priority: PRIORITIES.includes(raw.priority as Priority) ? (raw.priority as Priority) : 'normal',
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string') : [],
    notes: typeof raw.notes === 'string' ? raw.notes : '',
  }
}

/** 旧スキーマを現行スキーマへ引き上げる。バージョンが増えたらここに分岐を足す。 */
export function migrate(value: unknown): TodoStore {
  if (typeof value !== 'object' || value === null) return emptyStore
  const raw = value as Record<string, unknown>
  if (!Array.isArray(raw.todos)) return emptyStore

  return {
    schemaVersion: CURRENT_VERSION,
    todos: raw.todos.map(parseTodo).filter((todo): todo is Todo => todo !== null),
  }
}

export function load(): TodoStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return emptyStore
    return migrate(JSON.parse(raw))
  } catch {
    // JSON 破損・localStorage 無効（プライベートブラウジング等）でも
    // 画面が真っ白にならないよう、空の状態で起動する。
    return emptyStore
  }
}

export function save(todos: Todo[]): void {
  const store: TodoStore = { schemaVersion: CURRENT_VERSION, todos }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // 容量超過などは保存を諦める（操作自体はブロックしない）。
  }
}
