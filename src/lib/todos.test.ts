import { describe, expect, it } from 'vitest'
import type { Settings, Todo, TodoStore } from '../types'
import { diffInDays, formatDue, formatDueLabel, isOverdue, isToday, toHM, toISODate } from './date'
import {
  archiveOld,
  countActive,
  createSubtask,
  createTodo,
  dueMoment,
  filterTodos,
  mergeIncoming,
  needsAttention,
  nextDueDate,
  progressOf,
  sortTodos,
  storeReducer,
  todosToNotify,
  type Action,
} from './todos'
import { DEFAULT_SETTINGS, emptyStore, migrate } from './storage'
import { DEFAULT_CATEGORIES } from './categories'

const TODAY = '2026-08-17'

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
    spawnedFrom: null,
    ...overrides,
  }
}

function store(todos: Todo[], overrides: Partial<TodoStore> = {}): TodoStore {
  return { ...emptyStore, todos, ...overrides }
}

describe('date', () => {
  it('ローカルタイムで YYYY-MM-DD にする（UTC へずらさない）', () => {
    // ローカルの 23:30。UTC 変換だと翌日になりうる日時をあえて選ぶ。
    expect(toISODate(new Date(2026, 7, 17, 23, 30))).toBe('2026-08-17')
    expect(toISODate(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01')
  })

  it('ローカルタイムで HH:MM にする', () => {
    expect(toHM(new Date(2026, 7, 17, 9, 5))).toBe('09:05')
    expect(toHM(new Date(2026, 7, 17, 23, 59))).toBe('23:59')
  })

  it('日数差を求める', () => {
    expect(diffInDays(TODAY, TODAY)).toBe(0)
    expect(diffInDays('2026-08-18', TODAY)).toBe(1)
    expect(diffInDays('2026-08-16', TODAY)).toBe(-1)
    expect(diffInDays('2027-01-01', '2026-12-31')).toBe(1)
  })

  it('今日ぶんはまだ期限切れではない', () => {
    expect(isOverdue(TODAY, TODAY)).toBe(false)
    expect(isOverdue('2026-08-16', TODAY)).toBe(true)
    expect(isOverdue(null, TODAY)).toBe(false)
  })

  it('今日かどうかを判定する', () => {
    expect(isToday(TODAY, TODAY)).toBe(true)
    expect(isToday('2026-08-18', TODAY)).toBe(false)
    expect(isToday(null, TODAY)).toBe(false)
  })

  it('期限ラベルを短く出す', () => {
    expect(formatDueLabel(TODAY, TODAY)).toBe('今日')
    expect(formatDueLabel('2026-08-18', TODAY)).toBe('明日')
    expect(formatDueLabel('2026-08-16', TODAY)).toBe('昨日')
    expect(formatDueLabel('2026-12-05', TODAY)).toBe('12/5')
  })

  it('時刻があれば期限表示に付ける', () => {
    expect(formatDue(TODAY, null, TODAY)).toBe('今日')
    expect(formatDue(TODAY, '18:30', TODAY)).toBe('今日 18:30')
    expect(formatDue('2026-08-20', '09:00', TODAY)).toBe('8/20 09:00')
  })
})

describe('createTodo', () => {
  it('前後の空白を落とし、新フィールドを既定値で埋める', () => {
    const created = createTodo({ title: '  買い物  ' }, '2026-08-17T10:00:00.000Z', 'id-1')
    expect(created).toEqual({
      id: 'id-1',
      title: '買い物',
      done: false,
      dueDate: null,
      dueTime: null,
      createdAt: '2026-08-17T10:00:00.000Z',
      updatedAt: '2026-08-17T10:00:00.000Z',
      completedAt: null,
      icon: '',
      categoryId: null,
      notes: '',
      subtasks: [],
      notifiedAt: null,
      priority: 'normal',
    repeat: 'none',
    spawnedFrom: null,
    })
  })

  it('アイコン・カテゴリ・期限を受け取れる', () => {
    const created = createTodo(
      { title: 'x', dueDate: TODAY, dueTime: '18:30', icon: '🛒', categoryId: 'cat-home' },
      '2026-08-17T10:00:00.000Z',
      'id-2',
    )
    expect(created).toMatchObject({
      dueDate: TODAY,
      dueTime: '18:30',
      icon: '🛒',
      categoryId: 'cat-home',
    })
  })
})

describe('storeReducer: タスク', () => {
  const now = '2026-08-17T12:00:00.000Z'
  const a = todo({ id: 'a', title: 'A' })
  const b = todo({ id: 'b', title: 'B' })
  const run = (s: TodoStore, ...actions: Action[]) => actions.reduce(storeReducer, s)

  it('追加する', () => {
    expect(run(store([a]), { type: 'add', todo: b, now: '2026-08-17T00:00:00.000Z' }).todos.map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('完了トグルで completedAt を記録し、戻すと消す', () => {
    const done = run(store([a]), { type: 'toggle', id: 'a', now }).todos[0]
    expect(done).toMatchObject({ done: true, completedAt: now })
    const undone = storeReducer(store([done]), { type: 'toggle', id: 'a', now }).todos[0]
    expect(undone).toMatchObject({ done: false, completedAt: null })
  })

  it('更新はタイトルを trim し、updatedAt を進める', () => {
    const updated = run(store([a]), {
      type: 'update',
      id: 'a',
      patch: { title: '  新しい  ', notes: 'メモ', icon: '⭐' },
      now,
    }).todos[0]
    expect(updated).toMatchObject({ title: '新しい', notes: 'メモ', icon: '⭐', updatedAt: now })
    expect(updated.createdAt).toBe(a.createdAt)
  })

  it('期限を変えたら通知済みフラグを解除する（新しい期限で鳴らし直す）', () => {
    const notified = todo({ id: 'a', dueDate: TODAY, notifiedAt: '2026-08-17T09:00:00.000Z' })
    const moved = run(store([notified]), {
      type: 'update',
      id: 'a',
      patch: { dueDate: '2026-08-20' },
      now,
    }).todos[0]
    expect(moved.notifiedAt).toBeNull()
  })

  it('期限に関係ない更新では通知済みフラグを維持する', () => {
    const notified = todo({ id: 'a', dueDate: TODAY, notifiedAt: '2026-08-17T09:00:00.000Z' })
    const renamed = run(store([notified]), {
      type: 'update',
      id: 'a',
      patch: { title: '別名' },
      now,
    }).todos[0]
    expect(renamed.notifiedAt).toBe('2026-08-17T09:00:00.000Z')
  })

  it('該当しないタスクは同一参照のまま残す', () => {
    expect(run(store([a, b]), { type: 'toggle', id: 'a', now }).todos[1]).toBe(b)
  })

  it('削除し、同じタスクを add で元に戻せる', () => {
    const removed = run(store([a, b]), { type: 'remove', id: 'a', now })
    expect(removed.todos.map((t) => t.id)).toEqual(['b'])
    expect(run(removed, { type: 'add', todo: a, now: '2026-08-17T00:00:00.000Z' }).todos.map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('存在しない id は何もしない', () => {
    const s = store([a])
    expect(run(s, { type: 'remove', id: 'zzz', now }).todos).toEqual([a])
    expect(run(s, { type: 'toggle', id: 'zzz', now })).toBe(s)
  })

  it('markNotified で通知済みにする', () => {
    const next = run(store([a, b]), { type: 'markNotified', ids: ['a'], now })
    expect(next.todos[0].notifiedAt).toBe(now)
    expect(next.todos[1].notifiedAt).toBeNull()
  })
})

describe('storeReducer: サブタスク', () => {
  const now = '2026-08-17T12:00:00.000Z'
  const sub = (id: string, done = false) => ({ id, title: `sub-${id}`, done })
  const base = todo({ id: 'a', subtasks: [sub('s1'), sub('s2', true)] })

  it('追加する', () => {
    const next = storeReducer(store([base]), {
      type: 'subtask:add',
      id: 'a',
      subtask: createSubtask('  新しい  ', 's3'),
      now,
    })
    expect(next.todos[0].subtasks.map((s) => s.id)).toEqual(['s1', 's2', 's3'])
    expect(next.todos[0].subtasks[2].title).toBe('新しい')
    expect(next.todos[0].updatedAt).toBe(now)
  })

  it('完了をトグルする', () => {
    const next = storeReducer(store([base]), {
      type: 'subtask:toggle',
      id: 'a',
      subtaskId: 's1',
      now,
    })
    expect(next.todos[0].subtasks[0].done).toBe(true)
    expect(next.todos[0].subtasks[1].done).toBe(true)
  })

  it('名前を変える / 削除する', () => {
    const renamed = storeReducer(store([base]), {
      type: 'subtask:rename',
      id: 'a',
      subtaskId: 's1',
      title: '  改名  ',
      now,
    })
    expect(renamed.todos[0].subtasks[0].title).toBe('改名')

    const removed = storeReducer(store([base]), {
      type: 'subtask:remove',
      id: 'a',
      subtaskId: 's1',
      now,
    })
    expect(removed.todos[0].subtasks.map((s) => s.id)).toEqual(['s2'])
  })
})

describe('progressOf', () => {
  it('サブタスクが無ければ null', () => {
    expect(progressOf(todo({ id: 'a' }))).toBeNull()
  })

  it('完了数から比率を出す', () => {
    const t = todo({
      id: 'a',
      subtasks: [
        { id: '1', title: 'x', done: true },
        { id: '2', title: 'y', done: false },
        { id: '3', title: 'z', done: true },
        { id: '4', title: 'w', done: false },
      ],
    })
    expect(progressOf(t)).toEqual({ done: 2, total: 4, ratio: 0.5 })
  })

  it('全部終わっていれば 1', () => {
    const t = todo({ id: 'a', subtasks: [{ id: '1', title: 'x', done: true }] })
    expect(progressOf(t)).toEqual({ done: 1, total: 1, ratio: 1 })
  })
})

describe('storeReducer: カテゴリと設定', () => {
  const now = '2026-08-17T12:00:00.000Z'

  it('カテゴリを追加・更新し、更新時刻を進める', () => {
    const added = storeReducer(emptyStore, {
      type: 'category:add',
      category: { id: 'c1', name: '趣味', color: 'pink', updatedAt: now },
    })
    expect(added.categories.at(-1)).toEqual({ id: 'c1', name: '趣味', color: 'pink', updatedAt: now })

    const later = '2026-08-18T12:00:00.000Z'
    const updated = storeReducer(added, {
      type: 'category:update',
      id: 'c1',
      patch: { name: '趣味と遊び', color: 'teal' },
      now: later,
    })
    // 更新時刻が進まないと、この改名は次の同期でサーバーの古い値に巻き戻る。
    expect(updated.categories.at(-1)).toEqual({
      id: 'c1',
      name: '趣味と遊び',
      color: 'teal',
      updatedAt: later,
    })
  })

  it('カテゴリを消すと、参照していたタスクは未分類になる', () => {
    const s = store([todo({ id: 'a', categoryId: 'cat-work' }), todo({ id: 'b', categoryId: 'cat-home' })])
    const next = storeReducer(s, { type: 'category:remove', id: 'cat-work', now })
    expect(next.categories.some((c) => c.id === 'cat-work')).toBe(false)
    expect(next.todos[0].categoryId).toBeNull()
    expect(next.todos[1].categoryId).toBe('cat-home')
  })

  it('設定を部分更新し、更新時刻を進める', () => {
    const now = '2026-08-09T10:00:00.000Z'
    const next = storeReducer(emptyStore, {
      type: 'settings:update',
      patch: { notificationsEnabled: true },
      now,
    })
    expect(next.settings).toEqual({
      ...DEFAULT_SETTINGS,
      notificationsEnabled: true,
      updatedAt: now,
    })
  })

  it('テーマを変えても更新時刻が進む（同期でどちらが新しいかの判断に使う）', () => {
    const now = '2026-08-09T11:00:00.000Z'
    const next = storeReducer(emptyStore, { type: 'settings:update', patch: { theme: 'washi' }, now })
    expect(next.settings.theme).toBe('washi')
    expect(next.settings.updatedAt).toBe(now)
  })
})

describe('通知の判定', () => {
  const settings: Settings = { ...DEFAULT_SETTINGS, notificationsEnabled: true }
  const at = (h: number, m = 0) => new Date(2026, 7, 17, h, m)

  it('時刻未指定なら設定の既定時刻を使う', () => {
    expect(dueMoment(todo({ id: 'a', dueDate: TODAY }), settings)).toEqual(at(9))
    expect(dueMoment(todo({ id: 'a', dueDate: TODAY, dueTime: '18:30' }), settings)).toEqual(at(18, 30))
    expect(dueMoment(todo({ id: 'a' }), settings)).toBeNull()
  })

  it('期限時刻を過ぎたものだけ通知する', () => {
    const t = todo({ id: 'a', dueDate: TODAY, dueTime: '12:00' })
    expect(todosToNotify([t], settings, at(11, 59))).toEqual([])
    expect(todosToNotify([t], settings, at(12, 0)).map((x) => x.id)).toEqual(['a'])
  })

  it('完了済み・通知済みは対象外', () => {
    const done = todo({ id: 'a', dueDate: TODAY, dueTime: '09:00', done: true })
    const already = todo({ id: 'b', dueDate: TODAY, dueTime: '09:00', notifiedAt: 'x' })
    expect(todosToNotify([done, already], settings, at(10))).toEqual([])
  })

  it('24時間以上前に期限が過ぎたものは鳴らさない（起動時の通知の洪水を防ぐ）', () => {
    const old = todo({ id: 'a', dueDate: '2026-08-01', dueTime: '09:00' })
    expect(todosToNotify([old], settings, at(10))).toEqual([])

    const yesterday = todo({ id: 'b', dueDate: '2026-08-16', dueTime: '18:00' })
    expect(todosToNotify([yesterday], settings, at(10)).map((x) => x.id)).toEqual(['b'])
  })
})

describe('filterTodos', () => {
  const active = todo({ id: 'active' })
  const dueToday = todo({ id: 'today', dueDate: TODAY, categoryId: 'cat-work' })
  const overdue = todo({ id: 'overdue', dueDate: '2026-08-10', categoryId: 'cat-work' })
  const future = todo({ id: 'future', dueDate: '2026-09-01' })
  const finished = todo({ id: 'done', dueDate: '2026-08-10', done: true, completedAt: 'x' })
  const all = [active, dueToday, overdue, future, finished]

  const ids = (status: Parameters<typeof filterTodos>[1]['status'], categoryId: string | null = null) =>
    filterTodos(all, { status, categoryId, query: '' }, TODAY).map((t) => t.id)

  it('状態で絞る', () => {
    expect(ids('all')).toEqual(['active', 'today', 'overdue', 'future', 'done'])
    expect(ids('active')).toEqual(['active', 'today', 'overdue', 'future'])
    expect(ids('today')).toEqual(['today'])
    expect(ids('overdue')).toEqual(['overdue'])
    expect(ids('done')).toEqual(['done'])
  })

  it('カテゴリで絞る', () => {
    expect(ids('all', 'cat-work')).toEqual(['today', 'overdue'])
    expect(ids('all', 'cat-home')).toEqual([])
  })

  it('状態とカテゴリは AND で効く', () => {
    expect(ids('overdue', 'cat-work')).toEqual(['overdue'])
    expect(ids('today', 'cat-home')).toEqual([])
  })
})

describe('sortTodos', () => {
  it('未完了が先、期限が近い順、期限なしは末尾、同順なら新しい順', () => {
    const input = [
      todo({ id: 'no-due-old', createdAt: '2026-08-01T00:00:00.000Z' }),
      todo({ id: 'done-early', done: true, dueDate: '2026-08-01' }),
      todo({ id: 'due-late', dueDate: '2026-09-01' }),
      todo({ id: 'no-due-new', createdAt: '2026-08-05T00:00:00.000Z' }),
      todo({ id: 'due-soon', dueDate: '2026-08-18' }),
    ]
    expect(sortTodos(input).map((t) => t.id)).toEqual([
      'due-soon',
      'due-late',
      'no-due-new',
      'no-due-old',
      'done-early',
    ])
  })

  it('元の配列を変更しない', () => {
    const input = [todo({ id: 'b', dueDate: '2026-09-01' }), todo({ id: 'a', dueDate: '2026-08-01' })]
    sortTodos(input)
    expect(input.map((t) => t.id)).toEqual(['b', 'a'])
  })
})

describe('needsAttention', () => {
  it('期限切れと今日を分けて返し、完了済みは除く', () => {
    const todos = [
      todo({ id: 'o1', dueDate: '2026-08-10' }),
      todo({ id: 'o2', dueDate: '2026-08-15' }),
      todo({ id: 't1', dueDate: TODAY }),
      todo({ id: 'future', dueDate: '2026-09-01' }),
      todo({ id: 'done', dueDate: '2026-08-10', done: true }),
    ]
    const result = needsAttention(todos, TODAY)
    expect(result.overdue.map((t) => t.id)).toEqual(['o1', 'o2'])
    expect(result.today.map((t) => t.id)).toEqual(['t1'])
  })
})

describe('countActive', () => {
  it('未完了だけ数える', () => {
    expect(countActive([todo({ id: '1' }), todo({ id: '2', done: true }), todo({ id: '3' })])).toBe(2)
  })
})

describe('migrate', () => {
  it('v1 のデータを v6 に引き上げる（既定カテゴリと設定を新設）', () => {
    const v1 = {
      schemaVersion: 1,
      todos: [
        {
          id: 'a',
          title: '古いタスク',
          done: false,
          dueDate: '2026-08-20',
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
          completedAt: null,
          priority: 'normal',
    repeat: 'none',
    spawnedFrom: null,
          tags: [],
          notes: '前から書いてあったメモ',
        },
      ],
    }
    const s = migrate(v1)
    expect(s.schemaVersion).toBe(6)
    expect(s.tombstones).toEqual([])
    expect(s.categories).toEqual(DEFAULT_CATEGORIES)
    expect(s.settings).toEqual(DEFAULT_SETTINGS)
    expect(s.todos[0]).toMatchObject({
      id: 'a',
      title: '古いタスク',
      dueDate: '2026-08-20',
      // v1 に無かったフィールドが既定値で埋まる
      dueTime: null,
      icon: '',
      categoryId: null,
      subtasks: [],
      notifiedAt: null,
      // v1 から引き継ぐ
      notes: '前から書いてあったメモ',
    })
  })

  it('壊れた行だけ捨てて、正しい行は残す', () => {
    const s = migrate({ todos: [{ id: 'ok', title: 'OK' }, null, { title: 'id なし' }, 42] })
    expect(s.todos.map((t) => t.id)).toEqual(['ok'])
  })

  it('不正な値を既定値に落とす', () => {
    const s = migrate({
      todos: [
        {
          id: 'a',
          title: 'x',
          dueDate: 'おかしな値',
          dueTime: '99:99',
          icon: 'ながすぎるアイコン文字列',
          subtasks: '配列じゃない',
          priority: 'urgent',
        },
      ],
    })
    expect(s.todos[0]).toMatchObject({
      dueDate: null,
      dueTime: null,
      icon: '',
      subtasks: [],
      priority: 'normal',
    repeat: 'none',
    spawnedFrom: null,
    })
  })

  it('期限日が無いのに時刻だけ残っていたら捨てる', () => {
    const s = migrate({ todos: [{ id: 'a', title: 'x', dueTime: '10:00' }] })
    expect(s.todos[0].dueTime).toBeNull()
  })

  it('未完了なのに completedAt が入っていたら消す', () => {
    const s = migrate({ todos: [{ id: 'a', title: 'x', done: false, completedAt: 'yesterday' }] })
    expect(s.todos[0].completedAt).toBeNull()
  })

  it('存在しないカテゴリを指すタスクは未分類にする', () => {
    const s = migrate({
      todos: [{ id: 'a', title: 'x', categoryId: '消えたカテゴリ' }],
      categories: [{ id: 'c1', name: '仕事', color: 'blue' }],
    })
    expect(s.todos[0].categoryId).toBeNull()
  })

  it('壊れたカテゴリ行と不正な色を落とす', () => {
    const s = migrate({
      todos: [],
      categories: [{ id: 'c1', name: '色が変', color: 'まぶしい' }, { name: 'id なし' }, null],
    })
    expect(s.categories).toMatchObject([{ id: 'c1', name: '色が変', color: 'gray' }])
  })

  it('サブタスクを検証して壊れた要素を捨てる', () => {
    const s = migrate({
      todos: [{ id: 'a', title: 'x', subtasks: [{ id: 's1', title: 'ok', done: true }, {}, null] }],
    })
    expect(s.todos[0].subtasks).toEqual([{ id: 's1', title: 'ok', done: true }])
  })

  it('v2 のデータは墓標の配列を足すだけで引き上がる', () => {
    const v2 = {
      schemaVersion: 2,
      todos: [{ id: 'a', title: 'x', icon: '📄', subtasks: [] }],
      categories: [{ id: 'c1', name: '仕事', color: 'blue' }],
      settings: { notificationsEnabled: true, defaultNotifyTime: '08:00' },
    }
    const s = migrate(v2)
    expect(s.schemaVersion).toBe(6)
    expect(s.tombstones).toEqual([])
    expect(s.todos[0]).toMatchObject({ id: 'a', icon: '📄' })
    expect(s.categories).toMatchObject([{ id: 'c1', name: '仕事', color: 'blue' }])
    expect(s.settings.defaultNotifyTime).toBe('08:00')
  })

  it('墓標を読み込み、古すぎるものと壊れたものは捨てる', () => {
    const now = Date.parse('2026-08-17T00:00:00.000Z')
    const s = migrate(
      {
        todos: [],
        tombstones: [
          { id: 'recent', kind: 'todo', deletedAt: '2026-08-16T00:00:00.000Z' },
          { id: 'old', kind: 'todo', deletedAt: '2026-01-01T00:00:00.000Z' },
          { id: 'bad-kind', kind: 'なにか', deletedAt: '2026-08-16T00:00:00.000Z' },
          { id: 'bad-date', kind: 'todo', deletedAt: 'いつか' },
          null,
        ],
      },
      now,
    )
    expect(s.tombstones.map((t) => t.id)).toEqual(['recent'])
  })

  it('形が違う入力は空ストアにする', () => {
    expect(migrate(null)).toEqual(emptyStore)
    expect(migrate('文字列')).toEqual(emptyStore)
    expect(migrate({ todos: '配列じゃない' })).toEqual(emptyStore)
  })
})

describe('繰り返し', () => {
  const base = todo({ id: 'r', dueDate: '2026-08-17', repeat: 'weekly' })

  it('毎日 / 毎週 / 毎月で次の期限を出す', () => {
    expect(nextDueDate('2026-08-17', 'daily', '2026-08-17')).toBe('2026-08-18')
    expect(nextDueDate('2026-08-17', 'weekly', '2026-08-17')).toBe('2026-08-24')
    expect(nextDueDate('2026-08-17', 'monthly', '2026-08-17')).toBe('2026-09-17')
  })

  it('月末は翌月の末日に丸める（2/31 を作らない）', () => {
    expect(nextDueDate('2026-01-31', 'monthly', '2026-01-31')).toBe('2026-02-28')
  })

  it('溜めてから消化しても、次回が過去日にならない', () => {
    // 3 週間ぶん放置してから完了にした場合。
    expect(nextDueDate('2026-08-03', 'weekly', '2026-08-20')).toBe('2026-08-24')
  })

  it('期限が無い、または繰り返さないなら次は無い', () => {
    expect(nextDueDate(null, 'weekly', '2026-08-17')).toBeNull()
    expect(nextDueDate('2026-08-17', 'none', '2026-08-17')).toBeNull()
  })

  it('完了にすると次回ぶんが増える', () => {
    const store = { ...emptyStore, todos: [base] }
    const next = storeReducer(store, {
      type: 'toggle',
      id: 'r',
      now: '2026-08-17T10:00:00.000Z',
      nextId: 'r2',
      today: '2026-08-17',
    })
    expect(next.todos).toHaveLength(2)
    expect(next.todos[0].done).toBe(true)
    expect(next.todos[1]).toMatchObject({
      id: 'r2',
      done: false,
      dueDate: '2026-08-24',
      repeat: 'weekly',
      notifiedAt: null,
    })
  })

  it('未完了に戻すときは増えない', () => {
    const store = { ...emptyStore, todos: [{ ...base, done: true }] }
    const next = storeReducer(store, {
      type: 'toggle',
      id: 'r',
      now: '2026-08-17T10:00:00.000Z',
      nextId: 'r2',
      today: '2026-08-17',
    })
    expect(next.todos).toHaveLength(1)
  })

  it('次回ぶんはサブタスクのチェックを戻して引き継ぐ', () => {
    const withSubs = {
      ...base,
      subtasks: [{ id: 's1', title: '下書き', done: true }],
    }
    const next = storeReducer(
      { ...emptyStore, todos: [withSubs] },
      { type: 'toggle', id: 'r', now: '2026-08-17T10:00:00.000Z', nextId: 'r2', today: '2026-08-17' },
    )
    expect(next.todos[1].subtasks).toEqual([{ id: 's1', title: '下書き', done: false }])
  })
})

describe('検索', () => {
  const items = [
    todo({ id: 'a', title: '請求書を出す' }),
    todo({ id: 'b', title: 'Meeting', notes: '会議室Aを予約する' }),
    todo({ id: 'c', title: 'ゴミ出し' }),
  ]
  const found = (query: string) =>
    filterTodos(items, { status: 'all', categoryId: null, query }, TODAY).map((t) => t.id)

  it('タイトルの部分一致で絞る', () => {
    expect(found('請求')).toEqual(['a'])
  })

  it('メモも探す', () => {
    expect(found('会議室')).toEqual(['b'])
  })

  it('大文字小文字を区別しない', () => {
    expect(found('meeting')).toEqual(['b'])
    expect(found('MEETING')).toEqual(['b'])
  })

  it('全角と半角の揺れを吸収する', () => {
    expect(found('ｍｅｅｔｉｎｇ')).toEqual(['b'])
  })

  it('空なら絞らない', () => {
    expect(found('')).toEqual(['a', 'b', 'c'])
    expect(found('   ')).toEqual(['a', 'b', 'c'])
  })

  it('一致しなければ空', () => {
    expect(found('存在しない')).toEqual([])
  })
})

describe('並び順の切り替え', () => {
  const high = todo({ id: 'high', dueDate: '2026-08-20', priority: 'high' })
  const low = todo({ id: 'low', dueDate: '2026-08-18', priority: 'low' })
  const normal = todo({ id: 'normal', dueDate: '2026-08-19', priority: 'normal' })

  it('期限順は期限が近い順', () => {
    expect(sortTodos([high, low, normal], 'due').map((t) => t.id)).toEqual(['low', 'normal', 'high'])
  })

  it('優先度順は高いものが上', () => {
    expect(sortTodos([low, normal, high], 'priority').map((t) => t.id)).toEqual([
      'high',
      'normal',
      'low',
    ])
  })

  it('期限順でも、同じ日なら優先度が高いほうが上', () => {
    const a = todo({ id: 'a', dueDate: '2026-08-18', priority: 'low' })
    const b = todo({ id: 'b', dueDate: '2026-08-18', priority: 'high' })
    expect(sortTodos([a, b], 'due').map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('どちらの並びでも完了は下', () => {
    const finished = todo({ id: 'done', done: true, priority: 'high' })
    expect(sortTodos([finished, low], 'priority').map((t) => t.id)).toEqual(['low', 'done'])
  })
})

describe('古い完了タスクの掃除', () => {
  const old = todo({
    id: 'old',
    done: true,
    completedAt: '2026-05-01T00:00:00.000Z',
    dueDate: '2026-05-01',
  })
  const recent = todo({
    id: 'recent',
    done: true,
    completedAt: '2026-08-15T00:00:00.000Z',
    dueDate: '2026-08-15',
  })
  const now = '2026-08-17T00:00:00.000Z'
  const withSettings = (days: number, todos = [old, recent, todo({ id: 'active' })]) => ({
    ...emptyStore,
    todos,
    settings: { ...emptyStore.settings, archiveAfterDays: days },
  })

  it('期間を過ぎた完了タスクだけ消す', () => {
    const next = archiveOld(withSettings(90), now)
    expect(next.todos.map((t) => t.id)).toEqual(['recent', 'active'])
  })

  it('消したことを墓標で残す（他の端末にも伝わる）', () => {
    const next = archiveOld(withSettings(90), now)
    expect(next.tombstones).toEqual([{ id: 'old', kind: 'todo', deletedAt: now }])
  })

  it('0 なら何もしない', () => {
    expect(archiveOld(withSettings(0), now).todos).toHaveLength(3)
  })

  it('消すものが無ければ元の参照をそのまま返す', () => {
    const store = withSettings(90, [recent])
    expect(archiveOld(store, now)).toBe(store)
  })

  it('未完了は期限が古くても消さない', () => {
    const stale = todo({ id: 'stale', dueDate: '2026-01-01' })
    expect(archiveOld(withSettings(30, [stale]), now).todos).toHaveLength(1)
  })
})

describe('まとめて操作', () => {
  const items = [todo({ id: 'a' }), todo({ id: 'b' }), todo({ id: 'c' })]
  const store = { ...emptyStore, todos: items }
  const now = '2026-08-17T10:00:00.000Z'

  it('選んだものだけ完了にする', () => {
    const next = storeReducer(store, { type: 'bulk:toggle', ids: ['a', 'c'], done: true, now })
    expect(next.todos.map((t) => t.done)).toEqual([true, false, true])
    expect(next.todos[0].completedAt).toBe(now)
  })

  it('選んだものの期限をまとめて変える', () => {
    const next = storeReducer(store, { type: 'bulk:due', ids: ['b'], dueDate: '2026-08-20', now })
    expect(next.todos[1].dueDate).toBe('2026-08-20')
    // 期限が変わったら、通知済みの印は消す（新しい期限で鳴らし直す）。
    expect(next.todos[1].notifiedAt).toBeNull()
  })

  it('期限を外すと時刻も外れる', () => {
    const timed = { ...emptyStore, todos: [todo({ id: 'a', dueDate: '2026-08-17', dueTime: '10:00' })] }
    const next = storeReducer(timed, { type: 'bulk:due', ids: ['a'], dueDate: null, now })
    expect(next.todos[0]).toMatchObject({ dueDate: null, dueTime: null })
  })

  it('選んだものをまとめて消し、墓標を残す', () => {
    const next = storeReducer(store, { type: 'bulk:remove', ids: ['a', 'b'], now })
    expect(next.todos.map((t) => t.id)).toEqual(['c'])
    expect(next.tombstones.map((t) => t.id).sort()).toEqual(['a', 'b'])
  })

  it('何も選んでいなければ何も起きない', () => {
    expect(storeReducer(store, { type: 'bulk:remove', ids: [], now })).toBe(store)
  })
})

describe('レビューで見つかった穴（回帰）', () => {
  it('毎月の繰り返しで、日にちが後戻りしない', () => {
    // 1/31 → 2/28 に丸めたあと、その 28 日を基準にすると二度と 31 日へ戻らなかった。
    expect(nextDueDate('2026-01-31', 'monthly', '2026-01-31')).toBe('2026-02-28')
    expect(nextDueDate('2026-01-31', 'monthly', '2026-02-28')).toBe('2026-03-31')
    expect(nextDueDate('2026-01-31', 'monthly', '2026-03-31')).toBe('2026-04-30')
    expect(nextDueDate('2026-01-31', 'monthly', '2026-04-30')).toBe('2026-05-31')
  })

  it('長く放置しても、次回が過去日にならない', () => {
    // 2 年以上前の毎日の繰り返し。以前は上限に当たって過去日を返していた。
    const next = nextDueDate('2024-01-01', 'daily', '2026-08-18')
    expect(next).not.toBeNull()
    expect(next! > '2026-08-18').toBe(true)
  })

  it('まとめて完了にしても、繰り返しの次回が作られる', () => {
    const a = todo({ id: 'a', dueDate: '2026-08-17', repeat: 'weekly' })
    const b = todo({ id: 'b', dueDate: '2026-08-17' })
    const next = storeReducer(
      { ...emptyStore, todos: [a, b] },
      {
        type: 'bulk:toggle',
        ids: ['a', 'b'],
        done: true,
        now: '2026-08-17T10:00:00.000Z',
        nextIds: ['a2', 'b2'],
        today: '2026-08-17',
      },
    )
    expect(next.todos.filter((t) => !t.done).map((t) => t.id)).toEqual(['a2'])
    expect(next.todos.find((t) => t.id === 'a2')?.dueDate).toBe('2026-08-24')
  })

  it('古い完了タスクの掃除は、既定では起きない', () => {
    const old = todo({ id: 'old', done: true, completedAt: '2026-01-01T00:00:00.000Z' })
    const store = { ...emptyStore, todos: [old] }
    expect(store.settings.archiveAfterDays).toBe(0)
    expect(archiveOld(store, '2026-08-18T00:00:00.000Z')).toBe(store)
  })

  it('掃除を 2 回走らせても、墓標は 1 本にとどまる', () => {
    const old = todo({ id: 'old', done: true, completedAt: '2026-01-01T00:00:00.000Z' })
    const store = {
      ...emptyStore,
      todos: [old],
      settings: { ...emptyStore.settings, archiveAfterDays: 90 },
    }
    const once = archiveOld(store, '2026-08-18T00:00:00.000Z')
    const twice = archiveOld({ ...once, todos: [old] }, '2026-08-18T00:00:00.000Z')
    expect(twice.tombstones).toHaveLength(1)
  })

  it('完了日が壊れているタスクは掃除の対象にしない', () => {
    const broken = todo({ id: 'broken', done: true, completedAt: 'こわれた日時' })
    const store = {
      ...emptyStore,
      todos: [broken],
      settings: { ...emptyStore.settings, archiveAfterDays: 30 },
    }
    expect(archiveOld(store, '2026-08-18T00:00:00.000Z').todos).toHaveLength(1)
  })
})

describe('同期の取り込み（往復中の編集を守る）', () => {
  const at = (iso: string) => iso

  it('往復の間に足したタスクが消えない', () => {
    // 以前は丸ごと差し替えていたため、通信中に追加したぶんが消えていた。
    const current = { ...emptyStore, todos: [todo({ id: 'new', title: '通信中に追加' })] }
    const incoming = { ...emptyStore, todos: [todo({ id: 'server', title: 'サーバー由来' })] }
    const merged = mergeIncoming(current, incoming)
    expect(merged.todos.map((t) => t.id).sort()).toEqual(['new', 'server'])
  })

  it('往復の間に編集したぶんが巻き戻らない', () => {
    const current = {
      ...emptyStore,
      todos: [todo({ id: 'a', title: 'あとで直した', updatedAt: at('2026-08-10T00:00:00.000Z') })],
    }
    const incoming = {
      ...emptyStore,
      todos: [todo({ id: 'a', title: 'サーバーの内容', updatedAt: at('2026-08-01T00:00:00.000Z') })],
    }
    expect(mergeIncoming(current, incoming).todos[0].title).toBe('あとで直した')
  })

  it('同期の結果として消えたものは、復活させない', () => {
    const current = { ...emptyStore, todos: [todo({ id: 'gone' })] }
    const incoming = {
      ...emptyStore,
      todos: [],
      tombstones: [{ id: 'gone', kind: 'todo' as const, deletedAt: at('2026-08-10T00:00:00.000Z') }],
    }
    expect(mergeIncoming(current, incoming).todos).toEqual([])
  })

  it('カテゴリも同じ規則で守る', () => {
    const current = {
      ...emptyStore,
      categories: [{ id: 'c1', name: '直した', color: 'red' as const, updatedAt: at('2026-08-10T00:00:00.000Z') }],
    }
    const incoming = {
      ...emptyStore,
      categories: [{ id: 'c1', name: '古い', color: 'blue' as const, updatedAt: at('2026-08-01T00:00:00.000Z') }],
    }
    expect(mergeIncoming(current, incoming).categories[0].name).toBe('直した')
  })
})

describe('繰り返しの取り消し', () => {
  it('完了を戻すと、作られた次回ぶんも取り下げる', () => {
    const parent = todo({ id: 'r', dueDate: '2026-08-17', repeat: 'weekly' })
    const done = storeReducer(
      { ...emptyStore, todos: [parent] },
      { type: 'toggle', id: 'r', now: '2026-08-17T10:00:00.000Z', nextId: 'r2', today: '2026-08-17' },
    )
    expect(done.todos).toHaveLength(2)

    const undone = storeReducer(done, {
      type: 'toggle',
      id: 'r',
      now: '2026-08-17T10:01:00.000Z',
      nextId: 'r3',
      today: '2026-08-17',
    })
    expect(undone.todos.map((t) => t.id)).toEqual(['r'])
    expect(undone.todos[0].done).toBe(false)
  })

  it('次回ぶんに手を入れていたら、取り下げない', () => {
    const parent = todo({ id: 'r', dueDate: '2026-08-17', repeat: 'weekly' })
    const done = storeReducer(
      { ...emptyStore, todos: [parent] },
      { type: 'toggle', id: 'r', now: '2026-08-17T10:00:00.000Z', nextId: 'r2', today: '2026-08-17' },
    )
    // 次回ぶんの題名を直した後で、親の完了を戻す。
    const edited = storeReducer(done, {
      type: 'update',
      id: 'r2',
      patch: { title: '大事な用事に変えた' },
      now: '2026-08-17T10:00:30.000Z',
    })
    const undone = storeReducer(edited, {
      type: 'toggle',
      id: 'r',
      now: '2026-08-17T10:01:00.000Z',
      nextId: 'r3',
      today: '2026-08-17',
    })
    expect(undone.todos.map((t) => t.id).sort()).toEqual(['r', 'r2'])
  })
})

describe('往復中の削除', () => {
  const base = (over: Partial<TodoStore> = {}): TodoStore => ({
    ...emptyStore, categories: [], ...over,
  })
  const t = (id: string, updatedAt: string): Todo => ({
    id, title: id, done: false, dueDate: null, dueTime: null,
    createdAt: updatedAt, updatedAt, completedAt: null, icon: '',
    categoryId: null, notes: '', subtasks: [], notifiedAt: null,
    priority: 'normal', repeat: 'none', spawnedFrom: null,
  })

  it('往復の間に消したものが復活しない', () => {
    // 同期の開始時点のスナップショット（まだ 'a' がある）
    const incoming = base({ todos: [t('a', '2026-08-01T00:00:00.000Z')] })
    // 往復の最中に 'a' を消した
    const current = base({
      todos: [],
      tombstones: [{ id: 'a', kind: 'todo' as const, deletedAt: '2026-08-02T00:00:00.000Z' }],
    })
    const merged = mergeIncoming(current, incoming)
    expect(merged.todos).toEqual([])
  })

  it('往復の間に立てた墓標を捨てない（次の同期で消しに行けること）', () => {
    const incoming = base({ todos: [t('a', '2026-08-01T00:00:00.000Z')] })
    const current = base({
      todos: [],
      tombstones: [{ id: 'a', kind: 'todo' as const, deletedAt: '2026-08-02T00:00:00.000Z' }],
    })
    expect(mergeIncoming(current, incoming).tombstones).toEqual([
      { id: 'a', kind: 'todo' as const, deletedAt: '2026-08-02T00:00:00.000Z' },
    ])
  })

  it('同期の結果として消えたものは、こちらの都合で復活させない', () => {
    const incoming = base({ todos: [], tombstones: [{ id: 'a', kind: 'todo' as const, deletedAt: '2026-08-03T00:00:00.000Z' }] })
    const current = base({ todos: [t('a', '2026-08-02T00:00:00.000Z')] })
    const merged = mergeIncoming(current, incoming)
    expect(merged.todos).toEqual([])
    expect(merged.tombstones).toEqual([{ id: 'a', kind: 'todo' as const, deletedAt: '2026-08-03T00:00:00.000Z' }])
  })

  it('墓標より後に編集し直していれば残る', () => {
    const incoming = base({ todos: [], tombstones: [{ id: 'a', kind: 'todo' as const, deletedAt: '2026-08-01T00:00:00.000Z' }] })
    const current = base({ todos: [t('a', '2026-08-05T00:00:00.000Z')] })
    const merged = mergeIncoming(current, incoming)
    expect(merged.todos.map((x) => x.id)).toEqual(['a'])
    expect(merged.tombstones).toEqual([])
  })

  it('墓標は id ごとに新しいほうへ寄せ、重複しない', () => {
    const incoming = base({ tombstones: [{ id: 'a', kind: 'todo' as const, deletedAt: '2026-08-01T00:00:00.000Z' }] })
    const current = base({ tombstones: [{ id: 'a', kind: 'todo' as const, deletedAt: '2026-08-04T00:00:00.000Z' }] })
    expect(mergeIncoming(current, incoming).tombstones).toEqual([
      { id: 'a', kind: 'todo' as const, deletedAt: '2026-08-04T00:00:00.000Z' },
    ])
  })
})

describe('元に戻す', () => {
  it('復活させたタスクは更新時刻が進む（次の同期でサーバーへ伝わる）', () => {
    const removed: Todo = {
      id: 'a', title: '請求書', done: false, dueDate: null, dueTime: null,
      createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
      completedAt: null, icon: '', categoryId: null, notes: '', subtasks: [],
      notifiedAt: null, priority: 'normal', repeat: 'none', spawnedFrom: null,
    }
    const after = storeReducer(
      { ...emptyStore, categories: [], todos: [], tombstones: [{ id: 'a', kind: 'todo' as const, deletedAt: '2026-08-02T00:00:00.000Z' }] },
      { type: 'add', todo: removed, now: '2026-08-03T00:00:00.000Z' },
    )
    expect(after.todos[0].updatedAt).toBe('2026-08-03T00:00:00.000Z')
    expect(after.tombstones).toEqual([])
  })
})
