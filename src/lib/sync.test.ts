import { describe, expect, it } from 'vitest'
import type { Settings, Todo, TodoStore } from '../types'
import { DEFAULT_SETTINGS, emptyStore } from './storage'
import {
  fromRemoteSettings,
  fromRemoteTodo,
  mergeStore,
  toRemoteSettings,
  toRemoteTodo,
  type RemoteCategory,
  type RemoteSettings,
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
    repeat: 'none',
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
  const remoteSettings = (patch: Partial<RemoteSettings> = {}): RemoteSettings => ({
    user_id: USER,
    notifications_enabled: true,
    default_notify_time: '08:15:00',
    time_zone: 'Asia/Tokyo',
    theme: 'washi',
    sort_mode: 'due',
    archive_after_days: 90,
    updated_at: '2026-08-05T00:00:00.000Z',
    ...patch,
  })

  const localSettings = (patch: Partial<Settings> = {}) => ({
    ...DEFAULT_SETTINGS,
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...patch,
  })

  it('サーバーに記録が無ければローカルを使う', () => {
    const local = store({
      settings: localSettings({ notificationsEnabled: true, defaultNotifyTime: '07:30' }),
    })
    expect(mergeStore(local, snapshot()).store.settings).toEqual(local.settings)
  })

  it('サーバーのほうが新しければ取り込み、秒は落とす', () => {
    const result = mergeStore(store({ settings: localSettings() }), {
      todos: [],
      categories: [],
      settings: remoteSettings(),
    })
    expect(result.store.settings).toMatchObject({
      notificationsEnabled: true,
      defaultNotifyTime: '08:15',
      theme: 'washi',
      updatedAt: '2026-08-05T00:00:00.000Z',
    })
  })

  it('ローカルのほうが新しければ、この端末の選択を残す', () => {
    // 端末でテーマを変えた直後に取り込みが走っても、選択が巻き戻らないこと。
    const local = store({
      settings: localSettings({ theme: 'midnight', updatedAt: '2026-08-09T00:00:00.000Z' }),
    })
    const result = mergeStore(local, {
      todos: [],
      categories: [],
      settings: remoteSettings(),
    })
    expect(result.store.settings.theme).toBe('midnight')
  })

  it('同じ時刻ならローカルを残す', () => {
    const at = '2026-08-05T00:00:00.000Z'
    const local = store({ settings: localSettings({ theme: 'mono', updatedAt: at }) })
    const result = mergeStore(local, {
      todos: [],
      categories: [],
      settings: remoteSettings({ updated_at: at }),
    })
    expect(result.store.settings.theme).toBe('mono')
  })

  it('明暗は同期しない（端末ごとの指定を残す）', () => {
    const local = store({ settings: localSettings({ appearance: 'dark' }) })
    const result = mergeStore(local, {
      todos: [],
      categories: [],
      settings: remoteSettings(),
    })
    expect(result.store.settings.appearance).toBe('dark')
  })

  it('サーバーに知らないテーマ名が入っていても、この端末の値を残す', () => {
    const local = store({ settings: localSettings({ theme: 'glass' }) })
    const result = mergeStore(local, {
      todos: [],
      categories: [],
      // 消したテーマ名や、まだこの版が知らないテーマ。
      settings: remoteSettings({ theme: 'kanban' }),
    })
    expect(result.store.settings.theme).toBe('glass')
  })

  it('サーバーの通知時刻が壊れていても落ちない', () => {
    const local = store({ settings: localSettings({ defaultNotifyTime: '06:45' }) })
    const result = mergeStore(local, {
      todos: [],
      categories: [],
      settings: remoteSettings({ default_notify_time: null as unknown as string }),
    })
    expect(result.store.settings.defaultNotifyTime).toBe('06:45')
  })
})

describe('toRemoteSettings', () => {
  it('テーマと更新時刻を載せ、明暗は載せない', () => {
    const row = toRemoteSettings(
      { ...DEFAULT_SETTINGS, theme: 'seventies', appearance: 'dark', updatedAt: '2026-08-09T00:00:00.000Z' },
      USER,
      'Asia/Tokyo',
    )
    expect(row).toEqual({
      user_id: USER,
      notifications_enabled: false,
      default_notify_time: '09:00',
      time_zone: 'Asia/Tokyo',
      theme: 'seventies',
      sort_mode: 'due',
      archive_after_days: 0,
      updated_at: '2026-08-09T00:00:00.000Z',
    })
    expect(row).not.toHaveProperty('appearance')
  })

  it('往復しても設定が変わらない', () => {
    const mine: Settings = {
      ...DEFAULT_SETTINGS,
      notificationsEnabled: true,
      defaultNotifyTime: '07:30',
      theme: 'botanical',
      updatedAt: '2026-08-09T00:00:00.000Z',
    }
    const back = fromRemoteSettings(toRemoteSettings(mine, USER, 'Asia/Tokyo'), DEFAULT_SETTINGS)
    expect(back).toEqual({ ...mine, appearance: DEFAULT_SETTINGS.appearance })
  })
})
