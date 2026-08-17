import type { TodoStore } from '../types'
import { CURRENT_VERSION, migrate } from './storage'

/**
 * 書き出し / 読み込み。
 *
 * ログインしない使い方だと、データはその端末にしか無い。
 * 端末を失うと全部消えるので、持ち出せる形を 1 つ用意しておく。
 *
 * 形式は保存しているものと同じ JSON に、いつ・どの版で出したかを添えただけ。
 * 読み込みは migrate() を通すので、古い版で出したファイルもそのまま入る。
 */
export type BackupFile = {
  app: 'todoApp'
  schemaVersion: number
  exportedAt: string
  store: TodoStore
}

export function toBackup(store: TodoStore, now: string = new Date().toISOString()): BackupFile {
  return { app: 'todoApp', schemaVersion: CURRENT_VERSION, exportedAt: now, store }
}

export function backupFileName(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `todo-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}.json`
}

export type ImportResult =
  | { ok: true; store: TodoStore; todos: number; categories: number }
  | { ok: false; reason: string }

/**
 * 読み込んだ文字列をストアに変換する。
 * ファイルは人が選ぶもの＝何が来るか分からないので、全部疑ってかかる。
 */
export function parseBackup(text: string, now: number = Date.now()): ImportResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'JSON として読めませんでした。' }
  }
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, reason: 'このアプリの書き出しファイルではないようです。' }
  }

  const box = raw as Record<string, unknown>
  // 書き出しファイルそのものと、中身のストアだけの JSON の両方を受ける。
  const candidate = box.store !== undefined ? box.store : box
  if (typeof candidate !== 'object' || candidate === null) {
    return { ok: false, reason: 'このアプリの書き出しファイルではないようです。' }
  }
  if (!Array.isArray((candidate as Record<string, unknown>).todos)) {
    return { ok: false, reason: 'タスクの一覧が見つかりませんでした。' }
  }

  const store = migrate(candidate, now)
  return { ok: true, store, todos: store.todos.length, categories: store.categories.length }
}

/**
 * 読み込んだ内容を今のデータに足す。同じ id は「更新が新しいほう」を残す。
 * 置き換えではなく併合にしておくと、間違えて古いファイルを入れても全部は消えない。
 */
export function mergeBackup(current: TodoStore, incoming: TodoStore): TodoStore {
  const todos = new Map(current.todos.map((t) => [t.id, t]))
  for (const t of incoming.todos) {
    const mine = todos.get(t.id)
    if (mine === undefined || t.updatedAt > mine.updatedAt) todos.set(t.id, t)
  }

  const categories = new Map(current.categories.map((c) => [c.id, c]))
  for (const c of incoming.categories) if (!categories.has(c.id)) categories.set(c.id, c)

  const known = new Set(categories.keys())
  return {
    ...current,
    todos: [...todos.values()].map((t) =>
      t.categoryId !== null && !known.has(t.categoryId) ? { ...t, categoryId: null } : t,
    ),
    categories: [...categories.values()],
  }
}
