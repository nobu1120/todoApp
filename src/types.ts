import type { Appearance, ThemeId } from './lib/themes'

export type Priority = 'high' | 'normal' | 'low'

/** 繰り返しの間隔。'none' は繰り返さない。 */
export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly'

/** 一覧の並び順。 */
export type SortMode = 'due' | 'priority'

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
  /** 完了したときに、次の予定を自動で作るか。期限がないタスクでは効かない。 */
  repeat: Repeat
}

export type Settings = {
  /** OS 通知を使うか。実際に出せるかは Notification の許可状態にも依る。 */
  notificationsEnabled: boolean
  /** 時刻を指定していないタスクを、その日の何時に通知するか。'HH:MM' */
  defaultNotifyTime: string
  /** 配色と書体の組み合わせ。値の定義は lib/themes.ts。 */
  theme: ThemeId
  /**
   * 明暗。'auto' は端末の設定に従う。
   * これは端末ごとの都合なので、同期はしない（別の端末の指定に引きずられないため）。
   */
  appearance: Appearance
  /** 一覧の並び順。 */
  sortMode: SortMode
  /**
   * 完了から何日たったタスクを自動で消すか。0 は消さない。
   * 完了タスクは放っておくと無限に溜まり、同期のたびに全件を往復することになる。
   */
  archiveAfterDays: number
  /** 設定を最後に変えた時刻（ISO 8601）。同期時にどちらが新しいかの判定に使う。 */
  updatedAt: string
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
  schemaVersion: 5
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
  /** タイトルとメモの部分一致。'' なら絞り込まない。 */
  query: string
}
