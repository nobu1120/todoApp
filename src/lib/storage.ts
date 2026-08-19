import type {
  Memo,
  Category,
  CategoryColor,
  Priority,
  Repeat,
  SortMode,
  Settings,
  Subtask,
  Todo,
  TodoStore,
  Tombstone,
} from '../types'
import { HM_RE, ISO_DATE_RE } from './date'
import { COLOR_KEYS, DEFAULT_CATEGORIES } from './categories'
import { DEFAULT_APPEARANCE, DEFAULT_THEME, isAppearance, isThemeId } from './themes'

export const STORAGE_KEY = 'todoApp.store'
export const CURRENT_VERSION = 8

/** 墓標を残しておく期間。これを過ぎたら、もうどの端末にも伝わっているとみなす。 */
const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000

export const DEFAULT_SETTINGS: Settings = {
  // 既定では OS 通知を使わない。許可ダイアログは設定から明示的に有効にしたときだけ出す。
  notificationsEnabled: false,
  defaultNotifyTime: '09:00',
  theme: DEFAULT_THEME,
  // 既定は端末の設定に従う。端末ごとに明暗が違っていて自然なため。
  appearance: DEFAULT_APPEARANCE,
  sortMode: 'due',
  /*
   * 既定は「消さない」。
   * ここを 90 にしていたため、更新した端末が初回起動した瞬間に、
   * 90 日以上前に完了したタスクが同意も予告もなく消え、墓標でサーバーへも
   * 伝播する状態になっていた。データを消す設定は、明示的に選んだときだけ効かせる。
   */
  archiveAfterDays: 0,
  // 一度も触っていない設定は、同期時にサーバー側へ譲る。
  updatedAt: new Date(0).toISOString(),
}

export const emptyStore: TodoStore = {
  schemaVersion: CURRENT_VERSION,
  todos: [],
  categories: DEFAULT_CATEGORIES,
  settings: DEFAULT_SETTINGS,
  tombstones: [],
  memo: { text: '', updatedAt: new Date(0).toISOString() },
}

const PRIORITIES: Priority[] = ['high', 'normal', 'low']
const REPEATS: Repeat[] = [
  'none',
  'daily',
  'weekday',
  'weekly',
  'monthly',
  'monthly-weekday',
]
const SORT_MODES: SortMode[] = ['due', 'priority']
/** 設定で選べる保存期間。ここに無い値は既定に落とす。 */
export const ARCHIVE_DAYS = [0, 30, 90, 365]

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
/*
 * 日時として読めるか。
 * 同期の判定は全部この文字列の大小比較なので、壊れた値を通すと厄介。
 * 'zzz' のような文字は辞書順であらゆる ISO 文字列より大きく、
 * その行が last-write-wins で永久に勝ち続けて毎回送り直される。
 */
const isISOTime = (v: unknown): v is string =>
  typeof v === 'string' && !Number.isNaN(Date.parse(v))

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
  const createdAt = isISOTime(raw.createdAt) ? raw.createdAt : new Date().toISOString()
  const done = raw.done === true

  return {
    id: raw.id,
    title: raw.title,
    done,
    dueDate,
    dueTime,
    createdAt,
    updatedAt: isISOTime(raw.updatedAt) ? raw.updatedAt : createdAt,
    completedAt: done && isISOTime(raw.completedAt) ? raw.completedAt : null,
    // 絵文字 1 つを想定。長すぎる文字列は表示が崩れるので弾く。
    icon: typeof raw.icon === 'string' && raw.icon.length <= 8 ? raw.icon : '',
    categoryId: typeof raw.categoryId === 'string' && raw.categoryId !== '' ? raw.categoryId : null,
    notes: asString(raw.notes),
    subtasks: Array.isArray(raw.subtasks)
      ? raw.subtasks.map(parseSubtask).filter((s): s is Subtask => s !== null)
      : [],
    notifiedAt: isISOTime(raw.notifiedAt) ? raw.notifiedAt : null,
    priority: PRIORITIES.includes(raw.priority as Priority) ? (raw.priority as Priority) : 'normal',
    repeat: REPEATS.includes(raw.repeat as Repeat) ? (raw.repeat as Repeat) : 'none',
    spawnedFrom: typeof raw.spawnedFrom === 'string' ? raw.spawnedFrom : null,
    // v7 で追加。古いデータには無いので、既定は「いつでも出る」。
    startDate: typeof raw.startDate === 'string' && ISO_DATE_RE.test(raw.startDate)
      ? raw.startDate
      : null,
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
    // 古いデータには無い。最古にしておき、同期ではサーバー側に譲る。
    updatedAt: isISOTime(raw.updatedAt) ? raw.updatedAt : new Date(0).toISOString(),
  }
}

export function parseSettings(value: unknown): Settings {
  if (typeof value !== 'object' || value === null) return DEFAULT_SETTINGS
  const raw = value as Record<string, unknown>
  return {
    notificationsEnabled: raw.notificationsEnabled === true,
    defaultNotifyTime:
      typeof raw.defaultNotifyTime === 'string' && HM_RE.test(raw.defaultNotifyTime)
        ? raw.defaultNotifyTime
        : DEFAULT_SETTINGS.defaultNotifyTime,
    // 知らないテーマ名（消したテーマ・古い版）は既定に落とす。
    theme: isThemeId(raw.theme) ? raw.theme : DEFAULT_THEME,
    appearance: isAppearance(raw.appearance) ? raw.appearance : DEFAULT_APPEARANCE,
    sortMode: SORT_MODES.includes(raw.sortMode as SortMode)
      ? (raw.sortMode as SortMode)
      : DEFAULT_SETTINGS.sortMode,
    archiveAfterDays:
      typeof raw.archiveAfterDays === 'number' && ARCHIVE_DAYS.includes(raw.archiveAfterDays)
        ? raw.archiveAfterDays
        : DEFAULT_SETTINGS.archiveAfterDays,
    updatedAt: isISOTime(raw.updatedAt) ? raw.updatedAt : DEFAULT_SETTINGS.updatedAt,
  }
}

function parseTombstone(value: unknown, now: number): Tombstone | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>
  if (typeof raw.id !== 'string' || raw.id === '') return null
  if (raw.kind !== 'todo' && raw.kind !== 'category') return null
  if (typeof raw.deletedAt !== 'string') return null
  const at = Date.parse(raw.deletedAt)
  // 日付として読めないもの、古すぎるものは捨てる。
  if (Number.isNaN(at) || now - at > TOMBSTONE_TTL_MS) return null
  return { id: raw.id, kind: raw.kind, deletedAt: raw.deletedAt }
}

/**
 * 旧スキーマを現行スキーマへ引き上げる。
 * v1（todos だけ / icon・カテゴリ・サブタスク無し）からの移行は、
 * 足りないフィールドを既定値で埋め、カテゴリと設定を新設することで行う。
 * v2 → v3 は墓標の配列を足すだけ。
 * v3 → v4 は設定にテーマと明暗を足すだけ（parseSettings が既定で埋める）。
 * v4 → v5 は繰り返し・並び順・保存期間を足すだけ。
 * v5 → v6 はカテゴリの更新時刻と、繰り返しの生成元を足すだけ。
 * いずれも既定値で埋まる。
 */
export function migrate(value: unknown, now: number = Date.now()): TodoStore {
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
    tombstones: Array.isArray(raw.tombstones)
      ? raw.tombstones
          .map((t) => parseTombstone(t, now))
          .filter((t): t is Tombstone => t !== null)
      : [],
    memo: parseMemo(raw.memo),
  }
}

/** v8 で追加。古いデータには無いので空で始める。 */
function parseMemo(value: unknown): Memo {
  const empty: Memo = { text: '', updatedAt: new Date(0).toISOString() }
  if (typeof value !== 'object' || value === null) return empty
  const raw = value as Record<string, unknown>
  return {
    text: typeof raw.text === 'string' ? raw.text : '',
    updatedAt: isISOTime(raw.updatedAt) ? raw.updatedAt : empty.updatedAt,
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

/**
 * 保存できたかを返す。
 *
 * ログインしていない使い方では localStorage が唯一の保存先なので、
 * ここが黙って失敗すると（容量超過・プライベートブラウジング）、
 * 画面は普通に動いているのに再読み込みした瞬間に全部消える。
 * 呼ぶ側が結果を見て利用者に報せられるようにしておく。
 */
export function save(store: TodoStore): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    return true
  } catch {
    // 容量超過などは保存を諦める（操作自体はブロックしない）。
    return false
  }
}
