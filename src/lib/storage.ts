import type {
  Category,
  CategoryColor,
  Priority,
  Settings,
  Subtask,
  Todo,
  TodoStore,
} from '../types'
import { HM_RE, ISO_DATE_RE } from './date'
import { COLOR_KEYS, DEFAULT_CATEGORIES } from './categories'

const STORAGE_KEY = 'todoApp.store'
const CURRENT_VERSION = 2

export const DEFAULT_SETTINGS: Settings = {
  // 既定では OS 通知を使わない。許可ダイアログは設定から明示的に有効にしたときだけ出す。
  notificationsEnabled: false,
  defaultNotifyTime: '09:00',
}

export const emptyStore: TodoStore = {
  schemaVersion: CURRENT_VERSION,
  todos: [],
  categories: DEFAULT_CATEGORIES,
  settings: DEFAULT_SETTINGS,
}

const PRIORITIES: Priority[] = ['high', 'normal', 'low']

const asString = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)

function parseSubtask(value: unknown): Subtask | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>
  if (typeof raw.id !== 'string' || raw.id === '') return null
  if (typeof raw.title !== 'string') return null
  return { id: raw.id, title: raw.title, done: raw.done === true }
}

/**
 * localStorage の中身は「外から書き換えられうる、信用できない JSON」として扱う。
 * 1 件ずつ検証し、壊れている行だけ捨てる（全体を捨てない）。
 */
function parseTodo(value: unknown): Todo | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>

  if (typeof raw.id !== 'string' || raw.id === '') return null
  if (typeof raw.title !== 'string') return null

  const dueDate =
    typeof raw.dueDate === 'string' && ISO_DATE_RE.test(raw.dueDate) ? raw.dueDate : null
  // 期限日が無いのに時刻だけ残っていても意味がないので落とす。
  const dueTime =
    dueDate !== null && typeof raw.dueTime === 'string' && HM_RE.test(raw.dueTime)
      ? raw.dueTime
      : null
  const createdAt = asString(raw.createdAt, new Date().toISOString())
  const done = raw.done === true

  return {
    id: raw.id,
    title: raw.title,
    done,
    dueDate,
    dueTime,
    createdAt,
    updatedAt: asString(raw.updatedAt, createdAt),
    completedAt: done && typeof raw.completedAt === 'string' ? raw.completedAt : null,
    // 絵文字 1 つを想定。長すぎる文字列は表示が崩れるので弾く。
    icon: typeof raw.icon === 'string' && raw.icon.length <= 8 ? raw.icon : '',
    categoryId: typeof raw.categoryId === 'string' && raw.categoryId !== '' ? raw.categoryId : null,
    notes: asString(raw.notes),
    subtasks: Array.isArray(raw.subtasks)
      ? raw.subtasks.map(parseSubtask).filter((s): s is Subtask => s !== null)
      : [],
    notifiedAt: typeof raw.notifiedAt === 'string' ? raw.notifiedAt : null,
    priority: PRIORITIES.includes(raw.priority as Priority) ? (raw.priority as Priority) : 'normal',
  }
}

function parseCategory(value: unknown): Category | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>
  if (typeof raw.id !== 'string' || raw.id === '') return null
  if (typeof raw.name !== 'string' || raw.name === '') return null
  return {
    id: raw.id,
    name: raw.name,
    color: COLOR_KEYS.includes(raw.color as CategoryColor)
      ? (raw.color as CategoryColor)
      : 'gray',
  }
}

function parseSettings(value: unknown): Settings {
  if (typeof value !== 'object' || value === null) return DEFAULT_SETTINGS
  const raw = value as Record<string, unknown>
  return {
    notificationsEnabled: raw.notificationsEnabled === true,
    defaultNotifyTime:
      typeof raw.defaultNotifyTime === 'string' && HM_RE.test(raw.defaultNotifyTime)
        ? raw.defaultNotifyTime
        : DEFAULT_SETTINGS.defaultNotifyTime,
  }
}

/**
 * 旧スキーマを現行スキーマへ引き上げる。
 * v1（todos だけ / icon・カテゴリ・サブタスク無し）からの移行は、
 * 足りないフィールドを既定値で埋め、カテゴリと設定を新設することで行う。
 */
export function migrate(value: unknown): TodoStore {
  if (typeof value !== 'object' || value === null) return emptyStore
  const raw = value as Record<string, unknown>
  if (!Array.isArray(raw.todos)) return emptyStore

  // categories が無い = v1。既定カテゴリを与える。
  const categories = Array.isArray(raw.categories)
    ? raw.categories.map(parseCategory).filter((c): c is Category => c !== null)
    : DEFAULT_CATEGORIES

  const known = new Set(categories.map((c) => c.id))
  const todos = raw.todos
    .map(parseTodo)
    .filter((t): t is Todo => t !== null)
    // 消えたカテゴリを指しているタスクは未分類に落とす。
    .map((t) => (t.categoryId !== null && !known.has(t.categoryId) ? { ...t, categoryId: null } : t))

  return {
    schemaVersion: CURRENT_VERSION,
    todos,
    categories,
    settings: parseSettings(raw.settings),
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

export function save(store: TodoStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // 容量超過などは保存を諦める（操作自体はブロックしない）。
  }
}
