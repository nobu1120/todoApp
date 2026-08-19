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
 *
 * 取り込んだ id の墓標は必ず取り下げる。これをしないと、
 * 「間違えて消したタスクをファイルから戻す」という復旧そのものが、
 * 次の同期で削除として送られ、サーバーからも消える。
 */
export function mergeBackup(current: TodoStore, incoming: TodoStore, now: string): TodoStore {
  /*
   * 取り込んだ行の更新時刻を「いま」にする。ファイルの中の古い時刻のままだと、
   * サーバーへ送る対象（updatedAt > 水位）に入らない。サーバー側に削除済みの
   * 記録が残っていれば、次の同期で「サーバーの削除のほうが新しい」と判定され、
   * 戻したはずのものがもう一度消える。
   */
  const todos = new Map(current.todos.map((t) => [t.id, t]))
  for (const t of incoming.todos) {
    const mine = todos.get(t.id)
    if (mine === undefined || t.updatedAt > mine.updatedAt) todos.set(t.id, { ...t, updatedAt: now })
  }

  // カテゴリもタスクと同じ規則にする（既存を無条件に優先すると、
  // 画面の説明「更新が新しいほうを残します」と食い違う）。
  const categories = new Map(current.categories.map((c) => [c.id, c]))
  for (const c of incoming.categories) {
    const mine = categories.get(c.id)
    if (mine === undefined || c.updatedAt > mine.updatedAt) categories.set(c.id, { ...c, updatedAt: now })
  }

  const known = new Set(categories.keys())
  const restored = new Set([...incoming.todos.map((t) => t.id), ...incoming.categories.map((c) => c.id)])

  return {
    ...current,
    todos: [...todos.values()].map((t) =>
      t.categoryId !== null && !known.has(t.categoryId) ? { ...t, categoryId: null } : t,
    ),
    categories: [...categories.values()],
    // 戻したものの墓標は取り下げる（他の追加経路と同じ扱いにする）。
    tombstones: current.tombstones.filter((t) => !restored.has(t.id)),
    // 設定も他の同期経路と同じ規則（更新が新しいほうを採る）で扱う。
    settings:
      incoming.settings.updatedAt > current.settings.updatedAt ? incoming.settings : current.settings,
    // メモも同じ規則。設定とは別に比べる。
    memo: incoming.memo.updatedAt > current.memo.updatedAt ? incoming.memo : current.memo,
  }
}
