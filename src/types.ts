import type { Appearance, ThemeId } from './lib/themes'

export type Priority = 'high' | 'normal' | 'low'

/** 繰り返しの間隔。'none' は繰り返さない。 */
/*
 * 繰り返しの規則。
 * 'weekday'         = 平日だけ（土日を飛ばす）
 * 'monthly-weekday' = 毎月の第N◯曜日（第2火曜など）。日にちではなく週で数える
 */
export type Repeat =
  | 'none'
  | 'daily'
  | 'weekday'
  | 'weekly'
  | 'monthly'
  | 'monthly-weekday'

/** 一覧の並び順。 */
export type SortMode = 'due' | 'priority' | 'manual'

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
  /**
   * 最後に変えた時刻（ISO 8601）。
   * これが無いと同期でどちらが新しいか判定できず、改名や色の変更が
   * サーバーの古い値に黙って巻き戻る。
   */
  updatedAt: string
}

export type Todo = {
  id: string
  title: string
  done: boolean
  /** 'YYYY-MM-DD'（ローカル日付）。未設定は null。 */
  dueDate: string | null
  /*
   * 着手日。この日が来るまで一覧に出さない。
   * 期限だけだと、3 週間後が締切のタスクが今日から居座り続け、
   * 一覧が「いま見る必要のないもの」で埋まる。
   */
  startDate: string | null
  /** 'HH:MM'（ローカル時刻）。未設定なら Settings.defaultNotifyTime を使う。 */
  dueTime: string | null
  /** ISO 8601 */
  createdAt: string
  updatedAt: string
  completedAt: string | null
  /** 絵文字 1 文字。'' はアイコンなし。 */
  icon: string
  /*
   * 手で並べ替えたときの位置。小さいほど上。
   * 間に落とせるよう小数を許す（両隣の中間を取る）。
   * 並びを変えたタスクだけ書き換えるので、絞り込み中に動かしても
   * 表に出ていないタスクの位置は壊れない。
   */
  order: number
  /** 排他。null は未分類。 */
  categoryId: string | null
  notes: string
  subtasks: Subtask[]
  /** 通知を出した時刻。重複通知を防ぐために記録する。 */
  notifiedAt: string | null
  priority: Priority
  /** 完了したときに、次の予定を自動で作るか。期限がないタスクでは効かない。 */
  repeat: Repeat
  /**
   * 繰り返しで自動生成された場合の、生成元のタスク id。
   * 完了を取り消したときに、作られた次回ぶんを一緒に取り下げるために使う。
   */
  spawnedFrom: string | null
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

/**
 * どこにも属さない 1 枚のメモ。
 * タスクにするほどでもない下書き・買い物の走り書き・パスワードの控え以外の
 * 「置き場所に困るもの」を 1 か所に集める。常に 1 枚だけで、増やせない。
 */
export type Memo = {
  text: string
  updatedAt: string
}

/** 買い物リストの 1 行。 */
export type ShoppingItem = {
  id: string
  name: string
  /** 1 以上。0 は「消す」の意味になるので持たせない。 */
  quantity: number
  /** 買ったか。 */
  done: boolean
}

/**
 * 買い物リスト。メモと同じく常に 1 つ。
 * その日の買い物のための走り書きなので、名前を付けて複数持つ必要がない。
 */
export type Shopping = {
  items: ShoppingItem[]
  updatedAt: string
}

export type TodoStore = {
  schemaVersion: 10
  todos: Todo[]
  categories: Category[]
  settings: Settings
  tombstones: Tombstone[]
  memo: Memo
  shopping: Shopping
}

export type StatusFilter = 'all' | 'active' | 'today' | 'overdue' | 'done'

export type Filter = {
  status: StatusFilter
  /** null なら全カテゴリ。 */
  categoryId: string | null
  /** タイトルとメモの部分一致。'' なら絞り込まない。 */
  query: string
}
