import { describe, expect, it } from 'vitest'
import type { Todo } from '../types'
import { storeReducer } from './todos'
import { emptyStore } from './storage'
import {
  addMonths,
  countByDate,
  currentYearMonth,
  formatDayLabel,
  formatMonthLabel,
  monthGrid,
  todosOnDate,
  toYearMonth,
  undatedCount,
  spansDate,
} from './calendar'

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
    spawnedFrom: null, startDate: null, order: 0,
    ...overrides,
  }
}

describe('年月の扱い', () => {
  it('日付から年月を取り出す', () => {
    expect(toYearMonth('2026-08-17')).toBe('2026-08')
  })

  it('今日の年月を出す', () => {
    expect(currentYearMonth(new Date(2026, 7, 17))).toBe('2026-08')
    // 1 桁の月はゼロ埋めする
    expect(currentYearMonth(new Date(2026, 0, 5))).toBe('2026-01')
  })

  it('前後に動かす', () => {
    expect(addMonths('2026-08', 1)).toBe('2026-09')
    expect(addMonths('2026-08', -1)).toBe('2026-07')
  })

  it('年をまたいでも正しい', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-08', 12)).toBe('2027-08')
  })
})

describe('monthGrid', () => {
  it('常に 6 週 × 7 日にする', () => {
    for (const ym of ['2026-08', '2026-02', '2027-02', '2026-11']) {
      const grid = monthGrid(ym)
      expect(grid).toHaveLength(6)
      for (const week of grid) expect(week).toHaveLength(7)
    }
  })

  it('日曜始まりで並べる', () => {
    // 2026-08-01 は土曜。その週は 7/26(日) から始まる。
    const grid = monthGrid('2026-08')
    expect(grid[0][0].date).toBe('2026-07-26')
    expect(grid[0][6].date).toBe('2026-08-01')
  })

  it('前後の月から借りたマスに印を付ける', () => {
    const grid = monthGrid('2026-08')
    expect(grid[0][0]).toEqual({ date: '2026-07-26', inMonth: false })
    expect(grid[0][6]).toEqual({ date: '2026-08-01', inMonth: true })
    const last = grid[5][6]
    expect(last.inMonth).toBe(false)
  })

  it('その月の日をすべて含む', () => {
    const dates = monthGrid('2026-08')
      .flat()
      .filter((d) => d.inMonth)
      .map((d) => d.date)
    expect(dates).toHaveLength(31)
    expect(dates[0]).toBe('2026-08-01')
    expect(dates[30]).toBe('2026-08-31')
  })

  it('閏年の 2 月は 29 日ある', () => {
    const dates = monthGrid('2028-02').flat().filter((d) => d.inMonth)
    expect(dates).toHaveLength(29)
    expect(dates[28].date).toBe('2028-02-29')
  })

  it('閏年でない 2 月は 28 日', () => {
    expect(monthGrid('2026-02').flat().filter((d) => d.inMonth)).toHaveLength(28)
  })

  it('日曜始まりの月でも前の月を借りない', () => {
    // 2026-11-01 は日曜
    const grid = monthGrid('2026-11')
    expect(grid[0][0]).toEqual({ date: '2026-11-01', inMonth: true })
  })

  it('マスが日付順に連続する', () => {
    const dates = monthGrid('2026-08').flat().map((d) => d.date)
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1])
      const cur = new Date(dates[i])
      expect(cur.getTime() - prev.getTime()).toBe(24 * 60 * 60 * 1000)
    }
  })
})

describe('表示ラベル', () => {
  it('月の見出し', () => {
    expect(formatMonthLabel('2026-08')).toBe('2026年 8月')
    expect(formatMonthLabel('2026-01')).toBe('2026年 1月')
  })

  it('日の見出しに曜日を付ける', () => {
    // 2026-08-17 は月曜
    expect(formatDayLabel('2026-08-17')).toBe('8月17日(月)')
    expect(formatDayLabel('2026-08-01')).toBe('8月1日(土)')
  })
})

describe('countByDate', () => {
  it('日付ごとに合計と完了数を数える', () => {
    const counts = countByDate([
      todo({ id: '1', dueDate: '2026-08-17' }),
      todo({ id: '2', dueDate: '2026-08-17', done: true }),
      todo({ id: '3', dueDate: '2026-08-20' }),
      todo({ id: '4', dueDate: null }),
    ])
    expect(counts['2026-08-17']).toEqual({ total: 2, done: 1 })
    expect(counts['2026-08-20']).toEqual({ total: 1, done: 0 })
    expect(counts['2026-08-21']).toBeUndefined()
  })

  it('期限なしは数えない', () => {
    expect(countByDate([todo({ id: '1' })])).toEqual({})
  })
})

describe('todosOnDate', () => {
  it('その日のものだけ返す', () => {
    const list = todosOnDate(
      [
        todo({ id: 'a', dueDate: '2026-08-17' }),
        todo({ id: 'b', dueDate: '2026-08-18' }),
      ],
      '2026-08-17',
    )
    expect(list.map((t) => t.id)).toEqual(['a'])
  })

  it('未完了が先、時刻の早い順、時刻なしは末尾', () => {
    const list = todosOnDate(
      [
        todo({ id: 'done', dueDate: '2026-08-17', dueTime: '08:00', done: true }),
        todo({ id: 'notime', dueDate: '2026-08-17' }),
        todo({ id: 'late', dueDate: '2026-08-17', dueTime: '18:30' }),
        todo({ id: 'early', dueDate: '2026-08-17', dueTime: '09:00' }),
      ],
      '2026-08-17',
    )
    expect(list.map((t) => t.id)).toEqual(['early', 'late', 'notime', 'done'])
  })

  it('元の配列を変更しない', () => {
    const input = [
      todo({ id: 'b', dueDate: '2026-08-17', dueTime: '18:00' }),
      todo({ id: 'a', dueDate: '2026-08-17', dueTime: '09:00' }),
    ]
    todosOnDate(input, '2026-08-17')
    expect(input.map((t) => t.id)).toEqual(['b', 'a'])
  })
})

describe('undatedCount', () => {
  it('期限が無い未完了だけ数える', () => {
    expect(
      undatedCount([
        todo({ id: '1' }),
        todo({ id: '2', done: true }),
        todo({ id: '3', dueDate: '2026-08-17' }),
        todo({ id: '4' }),
      ]),
    ).toBe(2)
  })
})

describe('着手日から期限までの帯', () => {
  const t = (over: Partial<Todo> & { id: string }): Todo => todo(over)

  describe('spansDate', () => {
    it('着手日と期限のあいだの日を含む', () => {
      const x = t({ id: 'a', startDate: '2026-08-10', dueDate: '2026-08-14' })
      expect(spansDate(x, '2026-08-10')).toBe(true)
      expect(spansDate(x, '2026-08-12')).toBe(true)
      expect(spansDate(x, '2026-08-14')).toBe(true)
    })

    it('範囲の外は含まない', () => {
      const x = t({ id: 'a', startDate: '2026-08-10', dueDate: '2026-08-14' })
      expect(spansDate(x, '2026-08-09')).toBe(false)
      expect(spansDate(x, '2026-08-15')).toBe(false)
    })

    it('着手日が無ければ帯にしない（期限の日だけ）', () => {
      expect(spansDate(t({ id: 'a', dueDate: '2026-08-14' }), '2026-08-12')).toBe(false)
    })

    it('期限が無ければ帯にしない（終わりが決まらない）', () => {
      expect(spansDate(t({ id: 'a', startDate: '2026-08-10' }), '2026-08-12')).toBe(false)
    })

    it('完了したものは帯にしない', () => {
      const x = t({ id: 'a', startDate: '2026-08-10', dueDate: '2026-08-14', done: true })
      expect(spansDate(x, '2026-08-12')).toBe(false)
    })

  })

  describe('countByDate', () => {
    it('件数は期限の日だけ数える（帯で水増ししない）', () => {
      const x = t({ id: 'a', startDate: '2026-08-10', dueDate: '2026-08-14' })
      const counts = countByDate([x])
      expect(counts['2026-08-14']?.total).toBe(1)
      // 帯の途中は印だけで、件数は 0 のまま。
      expect(counts['2026-08-12']?.total).toBe(0)
    })

    it('帯の途中の日には span の印が立つ', () => {
      const x = t({ id: 'a', startDate: '2026-08-10', dueDate: '2026-08-14' })
      const counts = countByDate([x])
      expect(counts['2026-08-12']?.span).toBe(true)
      expect(counts['2026-08-10']?.span).toBe(true)
      expect(counts['2026-08-09']?.span).toBeUndefined()
    })
  })

  describe('todosOnDate', () => {
    it('帯の途中の日にも、その日に着手できるものとして出す', () => {
      const x = t({ id: 'a', title: '資料作り', startDate: '2026-08-10', dueDate: '2026-08-14' })
      expect(todosOnDate([x], '2026-08-12').map((t) => t.id)).toEqual(['a'])
    })

    it('期限の日のものを先に並べる', () => {
      const span = t({ id: 'span', startDate: '2026-08-10', dueDate: '2026-08-20' })
      const due = t({ id: 'due', dueDate: '2026-08-12' })
      expect(todosOnDate([span, due], '2026-08-12').map((t) => t.id)).toEqual(['due', 'span'])
    })

    it('範囲の外には出さない', () => {
      const x = t({ id: 'a', startDate: '2026-08-10', dueDate: '2026-08-14' })
      expect(todosOnDate([x], '2026-08-20')).toEqual([])
    })
  })
})

describe('着手日は期限を超えない', () => {
  const base = { ...emptyStore, categories: [] }
  const T = '2026-08-18T00:00:00.000Z'

  it('着手日を期限より後にしたら、期限に合わせる', () => {
    const store = { ...base, todos: [todo({ id: 'a', dueDate: '2026-08-20' })] }
    const after = storeReducer(store, {
      type: 'update', id: 'a', patch: { startDate: '2026-08-25' }, now: T,
    })
    expect(after.todos[0].startDate).toBe('2026-08-20')
  })

  it('期限を着手日より前にしたら、着手日を引き戻す', () => {
    const store = {
      ...base,
      todos: [todo({ id: 'a', startDate: '2026-08-20', dueDate: '2026-08-25' })],
    }
    const after = storeReducer(store, {
      type: 'update', id: 'a', patch: { dueDate: '2026-08-15' }, now: T,
    })
    expect(after.todos[0].startDate).toBe('2026-08-15')
  })

  it('期限を外したら着手日はそのまま（縛るものが無くなる）', () => {
    const store = {
      ...base,
      todos: [todo({ id: 'a', startDate: '2026-08-20', dueDate: '2026-08-25' })],
    }
    const after = storeReducer(store, {
      type: 'update', id: 'a', patch: { dueDate: null }, now: T,
    })
    expect(after.todos[0].startDate).toBe('2026-08-20')
  })

  it('正しい順序なら触らない', () => {
    const store = {
      ...base,
      todos: [todo({ id: 'a', startDate: '2026-08-10', dueDate: '2026-08-25' })],
    }
    const after = storeReducer(store, {
      type: 'update', id: 'a', patch: { notes: 'メモ' }, now: T,
    })
    expect(after.todos[0].startDate).toBe('2026-08-10')
  })
})
