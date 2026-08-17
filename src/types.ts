/** 優先度。MVP では常に 'normal'、UI は第2弾で追加する。 */
export type Priority = 'high' | 'normal' | 'low'

export type Todo = {
  id: string
  title: string
  done: boolean
  /** 'YYYY-MM-DD'（ローカル日付、時刻なし）。未設定は null。 */
  dueDate: string | null
  /** ISO 8601 */
  createdAt: string
  updatedAt: string
  completedAt: string | null

  // --- 第2弾用の枠。MVP では既定値のまま、UI は出さない ---
  priority: Priority
  tags: string[]
  notes: string
}

export type TodoStore = {
  schemaVersion: 1
  todos: Todo[]
}

export type Filter = 'all' | 'active' | 'today' | 'overdue' | 'done'
