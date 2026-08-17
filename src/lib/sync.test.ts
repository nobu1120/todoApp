import { describe, expect, it } from 'vitest'
import type { Todo, TodoStore } from '../types'
import { emptyStore } from './storage'
import {
  fromRemoteTodo,
  mergeStore,
  toRemoteTodo,
  type RemoteCategory,
  type RemoteTodo,
} from './sync'

const USER = 'user-1'

function todo(overrides: Partial<Todo> & { id: string }): Todo {
  return {
    title: 'task',
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
    ...overrides,
  }
}

function remote(overrides: Partial<RemoteTodo> & { id: string }): RemoteTodo {
  return {
    ...toRemoteTodo(todo({ id: overrides.id }), USER),
    ...overrides,
  }
}

function store(overrides: Partial<TodoStore> = {}): TodoStore {
  return { ...emptyStore, categories: [], ...overrides }
}

const snapshot = (todos: RemoteTodo[] = [], categories: RemoteCategory[] = []) => ({
  todos,
  categories,
  settings: null,
})

describe('往復変換', () => {
  it('ローカル → サーバー → ローカルで内容が変わらない', () => {
    const original = todo({
      id: 'a',
      title: '請求書を出す',
      dueDate: '2026-08-20',
      dueTime: '18:30',
      icon: '📄',
      categoryId: 'cat-work',
      notes: 'メモ',
      subtasks: [{ id: 's1', title: '明細', done: true }],
      done: true,
      completedAt: '2026-08-19T00:00:00.000Z',
      notifiedAt: '2026-08-18T00:00:00.000Z',
    })
    expect(fromRemoteTodo(toRemoteTodo(original, USER))).toEqual(original)
  })

  it('サーバーが HH:MM:SS で返しても HH:MM に詰める', () => {
    expect(fromRemoteTodo(remote({ id: 'a', due_time: '18:30:00' })).dueTime).toBe('18:30')
  })

  it('壊れたサブタスクは捨てる', () => {
    const parsed = fromRemoteTodo(
      remote({ id: 'a', subtasks: [{ id: 's1', title: 'ok', done: true }, null, { title: 'id なし' }] }),
    )
    expect(parsed.subtasks).toEqual([{ id: 's1', title: 'ok', done: true }])
  })

  it('知らない優先度は normal に落とす', () => {
    expect(fromRemoteTodo(remote({ id: 'a', priority: 'urgent' })).priority).toBe('normal')
  })
})

describe('mergeStore: タスク', () => {
  it('サーバーだけにあるものを取り込む', () => {
    const result = mergeStore(store(), snapshot([remote({ id: 'a', title: '相手の端末で追加' })]))
    expect(result.store.todos.map((t) => t.title)).toEqual(['相手の端末で追加'])
    expect(result.pushTodos).toEqual([])
  })

  it('ローカルだけにあるものは送る', () => {
    const mine = todo({ id: 'a', title: 'この端末で追加' })
    const result = mergeStore(store({ todos: [mine] }), snapshot())
    expect(result.store.todos).toEqual([mine])
    expect(result.pushTodos.map((t) => t.id)).toEqual(['a'])
  })

  it('両方にあるときは更新が新しいほうを採る（サーバーが新しい）', () => {
    const mine = todo({ id: 'a', title: '古い', updatedAt: '2026-08-01T00:00:00.000Z' })
    const theirs = remote({ id: 'a', title: '新しい', updated_at: '2026-08-05T00:00:00.000Z' })
    const result = mergeStore(store({ todos: [mine] }), snapshot([theirs]))
    expect(result.store.todos[0].title).toBe('新しい')
    expect(result.pushTodos).toEqual([])
  })

  it('両方にあるときは更新が新しいほうを採る（ローカルが新しい）', () => {
    const mine = todo({ id: 'a', title: '新しい', updatedAt: '2026-08-09T00:00:00.000Z' })
    const theirs = remote({ id: 'a', title: '古い', updated_at: '2026-08-05T00:00:00.000Z' })
    const result = mergeStore(store({ todos: [mine] }), snapshot([theirs]))
    expect(result.store.todos[0].title).toBe('新しい')
    // ローカルが勝ったので、サーバーにも送り返す
    expect(result.pushTodos.map((t) => t.id)).toEqual(['a'])
  })
})

describe('mergeStore: 削除', () => {
  it('サーバーで消えたものはローカルからも消す', () => {
    const mine = todo({ id: 'a', updatedAt: '2026-08-01T00:00:00.000Z' })
    const theirs = remote({ id: 'a', deleted_at: '2026-08-05T00:00:00.000Z' })
    const result = mergeStore(store({ todos: [mine] }), snapshot([theirs]))
    expect(result.store.todos).toEqual([])
  })

  it('消された後にこちらで編集していれば、編集のほうを生かす', () => {
    const mine = todo({ id: 'a', title: '編集した', updatedAt: '2026-08-09T00:00:00.000Z' })
    const theirs = remote({ id: 'a', deleted_at: '2026-08-05T00:00:00.000Z' })
    const result = mergeStore(store({ todos: [mine] }), snapshot([theirs]))
    expect(result.store.todos.map((t) => t.title)).toEqual(['編集した'])
    expect(result.pushTodos.map((t) => t.id)).toEqual(['a'])
  })

  it('こちらで消したものはサーバーにも消したと伝える', () => {
    const theirs = remote({ id: 'a', updated_at: '2026-08-01T00:00:00.000Z' })
    const result = mergeStore(
      store({ tombstones: [{ id: 'a', kind: 'todo', deletedAt: '2026-08-05T00:00:00.000Z' }] }),
      snapshot([theirs]),
    )
    expect(result.store.todos).toEqual([])
    expect(result.pushDeletedTodoIds).toEqual(['a'])
  })

  it('消した後にサーバー側で更新されていれば、更新のほうを生かす', () => {
    const theirs = remote({ id: 'a', title: '他端末で編集', updated_at: '2026-08-09T00:00:00.000Z' })
    const result = mergeStore(
      store({ tombstones: [{ id: 'a', kind: 'todo', deletedAt: '2026-08-05T00:00:00.000Z' }] }),
      snapshot([theirs]),
    )
    expect(result.store.todos.map((t) => t.title)).toEqual(['他端末で編集'])
    expect(result.pushDeletedTodoIds).toEqual([])
  })

  it('墓標が消えた行を復活させない（同期を往復しても消えたまま）', () => {
    const first = mergeStore(
      store({ tombstones: [{ id: 'a', kind: 'todo', deletedAt: '2026-08-05T00:00:00.000Z' }] }),
      snapshot([remote({ id: 'a', updated_at: '2026-08-01T00:00:00.000Z' })]),
    )
    // サーバー側が deleted_at を立てた後にもう一度同期する
    const second = mergeStore(
      first.store,
      snapshot([remote({ id: 'a', deleted_at: '2026-08-06T00:00:00.000Z' })]),
    )
    expect(second.store.todos).toEqual([])
  })
})

describe('mergeStore: カテゴリ', () => {
  const category = (id: string, name: string, updated: string): RemoteCategory => ({
    id,
    user_id: USER,
    name,
    color: 'blue',
    updated_at: updated,
    deleted_at: null,
  })

  it('サーバーのカテゴリを取り込む', () => {
    const result = mergeStore(store(), snapshot([], [category('c1', '仕事', '2026-08-01T00:00:00.000Z')]))
    expect(result.store.categories).toEqual([{ id: 'c1', name: '仕事', color: 'blue' }])
  })

  it('知らない色は gray に落とす', () => {
    const result = mergeStore(
      store(),
      snapshot([], [{ ...category('c1', 'x', '2026-08-01T00:00:00.000Z'), color: 'まぶしい' }]),
    )
    expect(result.store.categories[0].color).toBe('gray')
  })

  it('消えたカテゴリを指したままのタスクは未分類に落とす', () => {
    const mine = todo({ id: 'a', categoryId: 'c-gone' })
    const result = mergeStore(store({ todos: [mine] }), snapshot())
    expect(result.store.todos[0].categoryId).toBeNull()
  })

  it('生きているカテゴリへの参照は保つ', () => {
    const mine = todo({ id: 'a', categoryId: 'c1' })
    const result = mergeStore(
      store({ todos: [mine] }),
      snapshot([], [category('c1', '仕事', '2026-08-01T00:00:00.000Z')]),
    )
    expect(result.store.todos[0].categoryId).toBe('c1')
  })
})

describe('mergeStore: 設定', () => {
  it('サーバーに記録が無ければローカルを使う', () => {
    const local = store({ settings: { notificationsEnabled: true, defaultNotifyTime: '07:30' } })
    expect(mergeStore(local, snapshot()).store.settings).toEqual({
      notificationsEnabled: true,
      defaultNotifyTime: '07:30',
    })
  })

  it('サーバーの設定を取り込み、秒は落とす', () => {
    const result = mergeStore(store(), {
      todos: [],
      categories: [],
      settings: {
        user_id: USER,
        notifications_enabled: true,
        default_notify_time: '08:15:00',
        time_zone: 'Asia/Tokyo',
        updated_at: '2026-08-05T00:00:00.000Z',
      },
    })
    expect(result.store.settings).toEqual({
      notificationsEnabled: true,
      defaultNotifyTime: '08:15',
    })
  })
})
