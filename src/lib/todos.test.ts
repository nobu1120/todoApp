import { describe, expect, it } from 'vitest'
import type { Todo } from '../types'
import { diffInDays, formatDueLabel, isOverdue, isToday, toISODate } from './date'
import {
  countActive,
  createTodo,
  filterTodos,
  sortTodos,
  todosReducer,
  type Action,
} from './todos'
import { migrate } from './storage'

const TODAY = '2026-08-17'

function todo(overrides: Partial<Todo> & { id: string }): Todo {
  return {
    title: 'task',
    done: false,
    dueDate: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    completedAt: null,
    priority: 'normal',
    tags: [],
    notes: '',
    ...overrides,
  }
}

describe('date', () => {
  it('ローカルタイムで YYYY-MM-DD にする（UTC へずらさない）', () => {
    // ローカルの 23:30。UTC 変換だと翌日になりうる日時をあえて選ぶ。
    expect(toISODate(new Date(2026, 7, 17, 23, 30))).toBe('2026-08-17')
    expect(toISODate(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01')
  })

  it('日数差を求める', () => {
    expect(diffInDays(TODAY, TODAY)).toBe(0)
    expect(diffInDays('2026-08-18', TODAY)).toBe(1)
    expect(diffInDays('2026-08-16', TODAY)).toBe(-1)
    expect(diffInDays('2026-09-01', TODAY)).toBe(15)
    // 年をまたぐ
    expect(diffInDays('2027-01-01', '2026-12-31')).toBe(1)
  })

  it('今日ぶんはまだ期限切れではない', () => {
    expect(isOverdue(TODAY, TODAY)).toBe(false)
    expect(isOverdue('2026-08-16', TODAY)).toBe(true)
    expect(isOverdue('2026-08-18', TODAY)).toBe(false)
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
    expect(formatDueLabel('2026-08-20', TODAY)).toBe('8/20')
    expect(formatDueLabel('2026-12-05', TODAY)).toBe('12/5')
  })
})

describe('createTodo', () => {
  it('前後の空白を落とし、既定値を埋める', () => {
    const created = createTodo({ title: '  買い物  ' }, '2026-08-17T10:00:00.000Z', 'id-1')
    expect(created).toEqual({
      id: 'id-1',
      title: '買い物',
      done: false,
      dueDate: null,
      createdAt: '2026-08-17T10:00:00.000Z',
      updatedAt: '2026-08-17T10:00:00.000Z',
      completedAt: null,
      priority: 'normal',
      tags: [],
      notes: '',
    })
  })

  it('期限を受け取れる', () => {
    const created = createTodo({ title: 'x', dueDate: TODAY }, '2026-08-17T10:00:00.000Z', 'id-2')
    expect(created.dueDate).toBe(TODAY)
  })
})

describe('todosReducer', () => {
  const now = '2026-08-17T12:00:00.000Z'
  const a = todo({ id: 'a', title: 'A' })
  const b = todo({ id: 'b', title: 'B' })

  const run = (state: Todo[], ...actions: Action[]) => actions.reduce(todosReducer, state)

  it('追加する', () => {
    expect(run([a], { type: 'add', todo: b }).map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('完了トグルで completedAt を記録し、戻すと消す', () => {
    const done = run([a], { type: 'toggle', id: 'a', now })[0]
    expect(done.done).toBe(true)
    expect(done.completedAt).toBe(now)

    const undone = todosReducer([done], { type: 'toggle', id: 'a', now: '2026-08-18T00:00:00.000Z' })[0]
    expect(undone.done).toBe(false)
    expect(undone.completedAt).toBeNull()
  })

  it('更新はタイトルを trim し、updatedAt を進める', () => {
    const updated = run([a], {
      type: 'update',
      id: 'a',
      patch: { title: '  新しい  ', dueDate: TODAY },
      now,
    })[0]
    expect(updated.title).toBe('新しい')
    expect(updated.dueDate).toBe(TODAY)
    expect(updated.updatedAt).toBe(now)
    expect(updated.createdAt).toBe(a.createdAt)
  })

  it('該当しない Todo は同一参照のまま残す', () => {
    const next = run([a, b], { type: 'toggle', id: 'a', now })
    expect(next[1]).toBe(b)
  })

  it('削除し、同じ Todo を add で元に戻せる', () => {
    const removed = run([a, b], { type: 'remove', id: 'a' })
    expect(removed.map((t) => t.id)).toEqual(['b'])
    expect(run(removed, { type: 'add', todo: a }).map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('存在しない id は何もしない', () => {
    expect(run([a], { type: 'remove', id: 'zzz' })).toEqual([a])
  })
})

describe('filterTodos', () => {
  const active = todo({ id: 'active', dueDate: null })
  const dueToday = todo({ id: 'today', dueDate: TODAY })
  const overdue = todo({ id: 'overdue', dueDate: '2026-08-10' })
  const future = todo({ id: 'future', dueDate: '2026-09-01' })
  const finished = todo({ id: 'done', dueDate: '2026-08-10', done: true, completedAt: 'x' })
  const all = [active, dueToday, overdue, future, finished]

  const ids = (filter: Parameters<typeof filterTodos>[1]) =>
    filterTodos(all, filter, TODAY).map((t) => t.id)

  it('all は全件', () => {
    expect(ids('all')).toEqual(['active', 'today', 'overdue', 'future', 'done'])
  })

  it('active は未完了のみ', () => {
    expect(ids('active')).toEqual(['active', 'today', 'overdue', 'future'])
  })

  it('today は今日が期限の未完了のみ', () => {
    expect(ids('today')).toEqual(['today'])
  })

  it('overdue は期限切れの未完了のみ（完了済みは含めない）', () => {
    expect(ids('overdue')).toEqual(['overdue'])
  })

  it('done は完了済みのみ', () => {
    expect(ids('done')).toEqual(['done'])
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

describe('countActive', () => {
  it('未完了だけ数える', () => {
    expect(countActive([todo({ id: '1' }), todo({ id: '2', done: true }), todo({ id: '3' })])).toBe(2)
  })
})

describe('migrate', () => {
  it('欠けているフィールドを既定値で埋める', () => {
    const store = migrate({
      schemaVersion: 1,
      todos: [{ id: 'a', title: '古いデータ', done: false, createdAt: '2026-08-01T00:00:00.000Z' }],
    })
    expect(store.todos).toHaveLength(1)
    expect(store.todos[0]).toMatchObject({
      id: 'a',
      title: '古いデータ',
      dueDate: null,
      priority: 'normal',
      tags: [],
      notes: '',
    })
  })

  it('壊れた行だけ捨てて、正しい行は残す', () => {
    const store = migrate({
      todos: [{ id: 'ok', title: 'OK', createdAt: 'x' }, null, { title: 'id なし' }, 42],
    })
    expect(store.todos.map((t) => t.id)).toEqual(['ok'])
  })

  it('不正な dueDate は null に落とす', () => {
    const store = migrate({ todos: [{ id: 'a', title: 'x', dueDate: 'おかしな値' }] })
    expect(store.todos[0].dueDate).toBeNull()
  })

  it('未完了なのに completedAt が入っていたら消す', () => {
    const store = migrate({ todos: [{ id: 'a', title: 'x', done: false, completedAt: 'yesterday' }] })
    expect(store.todos[0].completedAt).toBeNull()
  })

  it('形が違う入力は空ストアにする', () => {
    expect(migrate(null).todos).toEqual([])
    expect(migrate('文字列').todos).toEqual([])
    expect(migrate({ todos: '配列じゃない' }).todos).toEqual([])
  })
})
