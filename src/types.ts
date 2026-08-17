import type { Appearance, ThemeId } from './lib/themes'

export type Priority = 'high' | 'normal' | 'low'

export type Subtask = {
  id: string
  title: string
  done: boolean
}

/** カテゴリの色。実際の色値は index.css の --cat-* トークンで定義する。 */
export type CategoryColor =
  | 'blue'
  | 'green'
  | 'orange'
  | 'purple'
  | 'red'
  | 'teal'
  | 'pink'
  | 'gray'

export type Category = {
  id: string
  name: string
  color: CategoryColor
}

export type Todo = {
  id: string
  title: string
  done: boolean
  /** 'YYYY-MM-DD'（ローカル日付）。未設定は null。 */
  dueDate: string | null
  /** 'HH:MM'（ローカル時刻）。未設定なら Settings.defaultNotifyTime を使う。 */
  dueTime: string | null
  /** ISO 8601 */
  createdAt: string
  updatedAt: string
  completedAt: string | null
  /** 絵文字 1 文字。'' はアイコンなし。 */
  icon: string
  /** 排他。null は未分類。 */
  categoryId: string | null
  notes: string
  subtasks: Subtask[]
  /** 通知を出した時刻。重複通知を防ぐために記録する。 */
  notifiedAt: string | null
  priority: Priority
}

export type Settings = {
  /** OS 通知を使うか。実際に出せるかは Notification の許可状態にも依る。 */
  notificationsEnabled: boolean
  /** 時刻を指定していないタスクを、その日の何時に通知するか。'HH:MM' */
  defaultNotifyTime: string
  /** 配色と書体の組み合わせ。値の定義は lib/themes.ts。 */
  theme: ThemeId
  /** 明暗。'auto' は端末の設定に従う。 */
  appearance: Appearance
}

/**
 * 削除の墓標。物理削除だけだと、別の端末から同期したときに消したものが復活する。
 * 「いつ消したか」を残しておき、同期時に相手へ伝えるために使う。
 */
export type Tombstone = {
  id: string
  kind: 'todo' | 'category'
  deletedAt: string
}

export type TodoStore = {
  schemaVersion: 4
  todos: Todo[]
  categories: Category[]
  settings: Settings
  tombstones: Tombstone[]
}

export type StatusFilter = 'all' | 'active' | 'today' | 'overdue' | 'done'

export type Filter = {
  status: StatusFilter
  /** null なら全カテゴリ。 */
  categoryId: string | null
}
