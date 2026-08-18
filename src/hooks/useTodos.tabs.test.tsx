// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useTodos } from './useTodos'
import { emptyStore } from '../lib/storage'

const KEY = 'todoApp.store'

beforeEach(() => localStorage.clear())
afterEach(cleanup)

/** 別タブが保存した、という出来事を作る。 */
function otherTabSaves(store: unknown) {
  const value = JSON.stringify(store)
  localStorage.setItem(KEY, value)
  window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: value }))
}

describe('複数のタブ', () => {
  it('別タブで足したタスクを取り込む', () => {
    const { result } = renderHook(() => useTodos())
    act(() => result.current.add({ title: 'このタブのタスク' }))

    const mine = result.current.store.todos[0]
    act(() =>
      otherTabSaves({
        ...emptyStore,
        todos: [
          mine,
          {
            ...mine,
            id: 'other',
            title: '別タブのタスク',
            createdAt: '2026-08-18T00:00:00.000Z',
            updatedAt: '2026-08-18T00:00:00.000Z',
          },
        ],
      }),
    )

    expect(result.current.store.todos.map((t) => t.title).sort()).toEqual([
      'このタブのタスク',
      '別タブのタスク',
    ])
  })

  it('別タブの保存で、このタブのタスクが消えない', () => {
    // 以前は後から保存したタブが前のタブの内容を丸ごと上書きしていた。
    const { result } = renderHook(() => useTodos())
    act(() => result.current.add({ title: 'こちらで足した' }))

    // 別タブは、こちらの追加を知らない状態で保存する。
    act(() => otherTabSaves({ ...emptyStore, todos: [] }))

    expect(result.current.store.todos.map((t) => t.title)).toEqual(['こちらで足した'])
  })

  it('壊れた内容が飛んできても、いまの状態を壊さない', () => {
    const { result } = renderHook(() => useTodos())
    act(() => result.current.add({ title: '残ってほしい' }))

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: '{壊れている' }))
    })
    expect(result.current.store.todos.map((t) => t.title)).toEqual(['残ってほしい'])
  })

  it('関係のないキーの変更は無視する', () => {
    const { result } = renderHook(() => useTodos())
    act(() => result.current.add({ title: '残ってほしい' }))
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'other.key', newValue: '{}' }))
    })
    expect(result.current.store.todos).toHaveLength(1)
  })
})
