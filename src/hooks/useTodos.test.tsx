// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useTodos } from './useTodos'
import { emptyStore } from '../lib/storage'
import type { Todo } from '../types'

const KEY = 'todoApp.store'

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

const saved = () => JSON.parse(localStorage.getItem(KEY) ?? '{}')

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('useTodos', () => {
  it('追加すると localStorage に残る', () => {
    const { result } = renderHook(() => useTodos())
    act(() => result.current.add({ title: '請求書を出す' }))

    expect(result.current.store.todos).toHaveLength(1)
    expect(saved().todos[0].title).toBe('請求書を出す')
    expect(saved().schemaVersion).toBe(5)
  })

  it('保存済みのデータを読み戻す', () => {
    localStorage.setItem(KEY, JSON.stringify({ ...emptyStore, todos: [todo({ title: '前回の' })] }))
    const { result } = renderHook(() => useTodos())
    expect(result.current.store.todos[0].title).toBe('前回の')
  })

  it('壊れた保存データでも空で起動する（白画面にしない）', () => {
    localStorage.setItem(KEY, '{壊れている')
    const { result } = renderHook(() => useTodos())
    expect(result.current.store.todos).toEqual([])
  })

  it('既定では、古い完了タスクを勝手に消さない', () => {
    const old = todo({
      id: 'old',
      done: true,
      completedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
    })
    localStorage.setItem(KEY, JSON.stringify({ ...emptyStore, todos: [old] }))
    const { result } = renderHook(() => useTodos())
    expect(result.current.store.settings.archiveAfterDays).toBe(0)
    expect(result.current.store.todos.map((t) => t.id)).toEqual(['old'])
    expect(result.current.store.tombstones).toEqual([])
  })

  it('設定で選んだときだけ、期間を過ぎた完了タスクを掃除する', () => {
    const old = todo({
      id: 'old',
      done: true,
      completedAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
    })
    const recent = todo({ id: 'recent', done: true, completedAt: new Date().toISOString() })
    localStorage.setItem(
      KEY,
      JSON.stringify({
        ...emptyStore,
        todos: [old, recent],
        settings: { ...emptyStore.settings, archiveAfterDays: 90 },
      }),
    )

    const { result } = renderHook(() => useTodos())
    expect(result.current.store.todos.map((t) => t.id)).toEqual(['recent'])
    expect(result.current.store.tombstones.map((t) => t.id)).toEqual(['old'])
  })

  it('設定を変えると更新時刻が進む（同期の判定に使う）', () => {
    const { result } = renderHook(() => useTodos())
    const before = result.current.store.settings.updatedAt
    act(() => result.current.updateSettings({ theme: 'glass' }))
    expect(result.current.store.settings.theme).toBe('glass')
    expect(result.current.store.settings.updatedAt > before).toBe(true)
  })

  it('削除は取り消せる', () => {
    const { result } = renderHook(() => useTodos())
    act(() => result.current.add({ title: '消す' }))
    const id = result.current.store.todos[0].id

    act(() => result.current.remove(id))
    expect(result.current.store.todos).toHaveLength(0)
    expect(result.current.lastRemoved?.title).toBe('消す')

    act(() => result.current.undoRemove())
    expect(result.current.store.todos).toHaveLength(1)
  })

  it('繰り返しタスクを完了にすると、次回ぶんが増える', () => {
    const today = new Date().toISOString().slice(0, 10)
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...emptyStore, todos: [todo({ dueDate: today, repeat: 'daily' })] }),
    )
    const { result } = renderHook(() => useTodos())
    act(() => result.current.toggle('a'))

    expect(result.current.store.todos).toHaveLength(2)
    const next = result.current.store.todos.find((t) => t.id !== 'a')
    expect(next).toMatchObject({ done: false, repeat: 'daily' })
    expect(next?.dueDate).not.toBe(today)
  })

  it('書き出しファイルを取り込むと、足りないぶんだけ増える', () => {
    const { result } = renderHook(() => useTodos())
    act(() => result.current.add({ title: '元からある' }))

    let added = 0
    act(() => {
      added = result.current.importStore({
        ...emptyStore,
        todos: [todo({ id: 'x', title: 'ファイルから' })],
      })
    })
    expect(added).toBe(1)
    expect(result.current.store.todos.map((t) => t.title).sort()).toEqual([
      'ファイルから',
      '元からある',
    ])
  })

  it('まとめて完了・まとめて削除ができる', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...emptyStore, todos: [todo({ id: 'a' }), todo({ id: 'b' })] }),
    )
    const { result } = renderHook(() => useTodos())

    act(() => result.current.bulkToggle(['a', 'b'], true))
    expect(result.current.store.todos.every((t) => t.done)).toBe(true)

    act(() => result.current.bulkRemove(['a']))
    expect(result.current.store.todos.map((t) => t.id)).toEqual(['b'])
  })
})
