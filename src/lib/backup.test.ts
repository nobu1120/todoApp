import { describe, expect, it } from 'vitest'
import type { Todo, TodoStore } from '../types'
import { emptyStore } from './storage'
import { backupFileName, mergeBackup, parseBackup, toBackup } from './backup'

const todo = (patch: Partial<Todo> = {}): Todo => ({
  id: 'a',
  title: 'タスク',
  done: false,
  dueDate: null,
  dueTime: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  completedAt: null,
  icon: '',
  categoryId: null,
  notes: '',
  subtasks: [],
  notifiedAt: null,
  priority: 'normal',
  repeat: 'none',
  ...patch,
})

const store = (todos: Todo[]): TodoStore => ({ ...emptyStore, todos })

describe('書き出し', () => {
  it('版と日時を添えて包む', () => {
    const file = toBackup(store([todo()]), '2026-08-17T00:00:00.000Z')
    expect(file.app).toBe('todoApp')
    expect(file.schemaVersion).toBe(5)
    expect(file.exportedAt).toBe('2026-08-17T00:00:00.000Z')
    expect(file.store.todos).toHaveLength(1)
  })

  it('ファイル名に日付が入る', () => {
    expect(backupFileName(new Date(2026, 7, 5))).toBe('todo-20260805.json')
  })
})

describe('読み込み', () => {
  it('書き出したものをそのまま読み戻せる', () => {
    const json = JSON.stringify(toBackup(store([todo({ title: '請求書' })])))
    const result = parseBackup(json)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.store.todos[0].title).toBe('請求書')
  })

  it('ストアだけの JSON も受ける', () => {
    const result = parseBackup(JSON.stringify(store([todo()])))
    expect(result.ok).toBe(true)
  })

  it('古い版のファイルは移行して読む', () => {
    // v1 相当（カテゴリも設定も無い）。
    const old = JSON.stringify({ todos: [{ id: 'x', title: '古いタスク' }] })
    const result = parseBackup(old)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.store.schemaVersion).toBe(5)
      expect(result.store.todos[0]).toMatchObject({ id: 'x', repeat: 'none', priority: 'normal' })
    }
  })

  it('壊れた JSON は理由を返す（例外にしない）', () => {
    const result = parseBackup('{ こわれている')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('JSON')
  })

  it('別のアプリの JSON は弾く', () => {
    expect(parseBackup('{"foo":1}').ok).toBe(false)
    expect(parseBackup('null').ok).toBe(false)
    expect(parseBackup('[1,2,3]').ok).toBe(false)
  })
})

describe('取り込みの併合', () => {
  it('知らないタスクは足す', () => {
    const merged = mergeBackup(store([todo({ id: 'a' })]), store([todo({ id: 'b' })]))
    expect(merged.todos.map((t) => t.id).sort()).toEqual(['a', 'b'])
  })

  it('同じ id は更新が新しいほうを残す', () => {
    const mine = todo({ id: 'a', title: 'こちら', updatedAt: '2026-08-10T00:00:00.000Z' })
    const theirs = todo({ id: 'a', title: 'ファイル', updatedAt: '2026-08-11T00:00:00.000Z' })
    expect(mergeBackup(store([mine]), store([theirs])).todos[0].title).toBe('ファイル')
  })

  it('古いファイルを読んでも、今のほうが新しければ上書きしない', () => {
    const mine = todo({ id: 'a', title: 'こちら', updatedAt: '2026-08-12T00:00:00.000Z' })
    const theirs = todo({ id: 'a', title: 'ファイル', updatedAt: '2026-08-01T00:00:00.000Z' })
    expect(mergeBackup(store([mine]), store([theirs])).todos[0].title).toBe('こちら')
  })

  it('ファイル側にしか無いカテゴリは足す', () => {
    const current = { ...emptyStore, categories: [] }
    const incoming = { ...emptyStore, categories: [{ id: 'c1', name: '仕事', color: 'blue' as const }] }
    expect(mergeBackup(current, incoming).categories).toHaveLength(1)
  })

  it('どこにも無いカテゴリを指すタスクは未分類に落とす', () => {
    const incoming = { ...emptyStore, categories: [], todos: [todo({ id: 'z', categoryId: 'ghost' })] }
    const merged = mergeBackup({ ...emptyStore, categories: [] }, incoming)
    expect(merged.todos[0].categoryId).toBeNull()
  })
})
