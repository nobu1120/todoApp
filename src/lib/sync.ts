import type { Category, Repeat, Settings, Todo, TodoStore, Tombstone } from '../types'

/** サーバーから受け取ってよい繰り返しの値。知らない値は 'none' に落とす。 */
const REMOTE_REPEATS: Repeat[] = [
  'none',
  'daily',
  'weekday',
  'weekly',
  'monthly',
  'monthly-weekday',
]
import { COLOR_KEYS, DEFAULT_CATEGORIES } from './categories'
import { ARCHIVE_DAYS, CURRENT_VERSION } from './storage'
import { isThemeId } from './themes'
import { HM_RE } from './date'
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
  repeat: string | null
  spawned_from: string | null
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

/**
 * サーバー側の設定行。明暗（appearance）は載せない。
 * 端末ごとに違っていて自然なものなので、別の端末の指定で上書きされると困る。
 */
export type RemoteSettings = {
  user_id: string
  notifications_enabled: boolean
  default_notify_time: string
  time_zone: string
  theme: string | null
  sort_mode: string | null
  archive_after_days: number | null
  updated_at: string
}

/** 'HH:MM:SS' で返ってくることがあるので 'HH:MM' に詰める。 */
const shortTime = (t: string | null): string | null => (t === null ? null : t.slice(0, 5))

/*
 * サーバーの時刻を、ローカルと同じ 'Z' 形式に揃える。
 *
 * Postgres の timestamptz は '2026-08-01T00:00:00.123+00:00' で返り、
 * ローカルは toISOString の '...123Z'。同期の判定は全部この文字列の
 * 大小比較なので、揃えないと 'Z'(0x5A) > '+'(0x2B) で
 * 「同じ時刻なのにローカルが勝つ」が永久に続く。
 * 結果として毎回全件を送り直し、サーバーが立てた notified_at も潰れる。
 */
function atTime(value: string): string
function atTime(value: string | null): string | null
function atTime(value: string | null): string | null {
  if (value === null) return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? value : new Date(ms).toISOString()
}

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
    repeat: todo.repeat,
    spawned_from: todo.spawnedFrom,
    notified_at: todo.notifiedAt,
    created_at: todo.createdAt,
    updated_at: todo.updatedAt,
    completed_at: todo.completedAt,
    deleted_at: null,
  }
}

export function toRemoteCategory(category: Category, userId: string) {
  return {
    id: category.id,
    user_id: userId,
    name: category.name,
    color: category.color,
    // タスクや設定と同じく「いつの内容か」をそのまま載せる。
    updated_at: category.updatedAt,
    deleted_at: null,
  }
}

export function toRemoteSettings(
  settings: Settings,
  userId: string,
  timeZone: string,
): RemoteSettings {
  return {
    user_id: userId,
    notifications_enabled: settings.notificationsEnabled,
    default_notify_time: settings.defaultNotifyTime,
    time_zone: timeZone,
    theme: settings.theme,
    sort_mode: settings.sortMode,
    archive_after_days: settings.archiveAfterDays,
    // 「いつの設定か」をそのまま載せる。ここを送信時刻にすると、
    // 取り込んだだけの値が常に最新に見えて、他の端末の変更を潰してしまう。
    updated_at: settings.updatedAt,
  }
}

// --- サーバー → ローカル ------------------------------------------------------

/**
 * サーバー行から設定を作る。行の中身は信用せず、1 項目ずつ検証して
 * 読めないものはこの端末の値を残す（同期が丸ごと失敗するのを避ける）。
 */
export function fromRemoteSettings(row: RemoteSettings, fallback: Settings): Settings {
  const time = shortTime(row.default_notify_time)
  return {
    notificationsEnabled: row.notifications_enabled === true,
    defaultNotifyTime: time !== null && HM_RE.test(time) ? time : fallback.defaultNotifyTime,
    theme: isThemeId(row.theme) ? row.theme : fallback.theme,
    // 明暗は同期しない。この端末の指定をそのまま残す。
    appearance: fallback.appearance,
    sortMode: row.sort_mode === 'priority' || row.sort_mode === 'due' ? row.sort_mode : fallback.sortMode,
    // 保存期間はデータを消す設定なので、保存時と同じ選択肢だけを受け入れる。
    // ここを緩くすると、サーバー経由で「1 日で消す」のような値が入りうる。
    archiveAfterDays: ARCHIVE_DAYS.includes(row.archive_after_days as number)
      ? (row.archive_after_days as number)
      : fallback.archiveAfterDays,
    updatedAt: atTime(row.updated_at),
  }
}

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
    createdAt: atTime(row.created_at),
    updatedAt: atTime(row.updated_at),
    completedAt: atTime(row.completed_at),
    icon: row.icon,
    categoryId: row.category_id,
    notes: row.notes,
    subtasks,
    notifiedAt: atTime(row.notified_at),
    priority:
      row.priority === 'high' || row.priority === 'low' ? row.priority : 'normal',
    repeat: REMOTE_REPEATS.includes(row.repeat as Repeat) ? (row.repeat as Repeat) : 'none',
    spawnedFrom: typeof row.spawned_from === 'string' ? row.spawned_from : null,
  }
}

export function fromRemoteCategory(row: RemoteCategory): Category {
  return {
    id: row.id,
    name: row.name,
    color: COLOR_KEYS.includes(row.color as CategoryColor)
      ? (row.color as CategoryColor)
      : 'gray',
    updatedAt: atTime(row.updated_at),
  }
}

// --- 突き合わせ ---------------------------------------------------------------


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
      if (mine !== undefined && mine.updatedAt > atTime(row.deleted_at)) {
        mergedTodos.set(row.id, mine)
        pushTodos.push(mine)
      }
      continue
    }

    if (grave !== undefined && grave.deletedAt > atTime(row.updated_at)) {
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

  const localCategories = new Map(local.categories.map((c) => [c.id, c]))

  for (const row of remote.categories) {
    seenCategories.add(row.id)
    const grave = tombstoneById.get(row.id)

    const mineForRow = localCategories.get(row.id)

    if (row.deleted_at !== null) {
      /*
       * サーバーで消えている。タスクと同じく、こちらが後から
       * 触っていれば復活させる。無条件に消すと、他の端末で消した
       * カテゴリを改名しただけでその変更が黙って失われ、
       * それを指していたタスクが全部未分類に落ちる。
       */
      if (mineForRow !== undefined && mineForRow.updatedAt > atTime(row.deleted_at)) {
        mergedCategories.set(row.id, mineForRow)
        pushCategories.push(mineForRow)
      }
      continue
    }

    if (grave !== undefined && grave.deletedAt > atTime(row.updated_at)) {
      pushDeletedCategoryIds.push(row.id)
      continue
    }

    // タスクと同じ規則にする。無条件にサーバーを採ると、
    // この端末での改名・色の変更が毎回巻き戻る。
    const theirs = fromRemoteCategory(row)
    const mine = mineForRow
    if (mine !== undefined && mine.updatedAt > theirs.updatedAt) {
      mergedCategories.set(row.id, mine)
      pushCategories.push(mine)
    } else {
      mergedCategories.set(row.id, theirs)
    }
  }

  for (const category of local.categories) {
    if (seenCategories.has(category.id)) continue
    mergedCategories.set(category.id, category)
    pushCategories.push(category)
  }

  // ---- 設定 ----
  // 更新時刻の新しいほうを採る。同着とサーバー未記録はローカルを残す
  // （この端末で今まさに変えた直後に取り込みが走ることがあるため）。
  const settings: Settings =
    remote.settings === null || atTime(remote.settings.updated_at) <= local.settings.updatedAt
      ? local.settings
      : fromRemoteSettings(remote.settings, local.settings)

  // 消えたカテゴリを指したままのタスクを未分類に落とす。
  const categoryIds = new Set(mergedCategories.keys())
  const todos = [...mergedTodos.values()].map((todo) =>
    todo.categoryId !== null && !categoryIds.has(todo.categoryId)
      ? { ...todo, categoryId: null }
      : todo,
  )

  return {
    store: {
      schemaVersion: CURRENT_VERSION,
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

