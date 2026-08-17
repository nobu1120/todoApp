import { describe, expect, it } from 'vitest'
import type { Settings, Todo, TodoStore } from '../types'
import { diffInDays, formatDue, formatDueLabel, isOverdue, isToday, toHM, toISODate } from './date'
import {
  countActive,
  createSubtask,
  createTodo,
  dueMoment,
  filterTodos,
  needsAttention,
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
    expect(run(store([a]), { type: 'add', todo: b }).todos.map((t) => t.id)).toEqual(['a', 'b'])
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
    const removed = run(store([a, b]), { type: 'remove', id: 'a' })
    expect(removed.todos.map((t) => t.id)).toEqual(['b'])
    expect(run(removed, { type: 'add', todo: a }).todos.map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('存在しない id は何もしない', () => {
    const s = store([a])
    expect(run(s, { type: 'remove', id: 'zzz' }).todos).toEqual([a])
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

  it('カテゴリを追加・更新する', () => {
    const added = storeReducer(emptyStore, {
      type: 'category:add',
      category: { id: 'c1', name: '趣味', color: 'pink' },
    })
    expect(added.categories.at(-1)).toEqual({ id: 'c1', name: '趣味', color: 'pink' })

    const updated = storeReducer(added, {
      type: 'category:update',
      id: 'c1',
      patch: { name: '趣味と遊び', color: 'teal' },
    })
    expect(updated.categories.at(-1)).toEqual({ id: 'c1', name: '趣味と遊び', color: 'teal' })
  })

  it('カテゴリを消すと、参照していたタスクは未分類になる', () => {
    const s = store([todo({ id: 'a', categoryId: 'cat-work' }), todo({ id: 'b', categoryId: 'cat-home' })])
    const next = storeReducer(s, { type: 'category:remove', id: 'cat-work', now })
    expect(next.categories.some((c) => c.id === 'cat-work')).toBe(false)
    expect(next.todos[0].categoryId).toBeNull()
    expect(next.todos[1].categoryId).toBe('cat-home')
  })

  it('設定を部分更新する', () => {
    const next = storeReducer(emptyStore, {
      type: 'settings:update',
      patch: { notificationsEnabled: true },
    })
    expect(next.settings).toEqual({ ...DEFAULT_SETTINGS, notificationsEnabled: true })
  })
})

describe('通知の判定', () => {
  const settings: Settings = { notificationsEnabled: true, defaultNotifyTime: '09:00' }
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
    filterTodos(all, { status, categoryId }, TODAY).map((t) => t.id)

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
  it('v1 のデータを v2 に引き上げる（既定カテゴリと設定を新設）', () => {
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
          tags: [],
          notes: '前から書いてあったメモ',
        },
      ],
    }
    const s = migrate(v1)
    expect(s.schemaVersion).toBe(2)
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
    expect(s.categories).toEqual([{ id: 'c1', name: '色が変', color: 'gray' }])
  })

  it('サブタスクを検証して壊れた要素を捨てる', () => {
    const s = migrate({
      todos: [{ id: 'a', title: 'x', subtasks: [{ id: 's1', title: 'ok', done: true }, {}, null] }],
    })
    expect(s.todos[0].subtasks).toEqual([{ id: 's1', title: 'ok', done: true }])
  })

  it('形が違う入力は空ストアにする', () => {
    expect(migrate(null)).toEqual(emptyStore)
    expect(migrate('文字列')).toEqual(emptyStore)
    expect(migrate({ todos: '配列じゃない' })).toEqual(emptyStore)
  })
})
