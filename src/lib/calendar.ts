import type { Todo } from '../types'
import { toISODate } from './date'

/** 'YYYY-MM' 形式の年月。 */
export type YearMonth = string

export const YM_RE = /^\d{4}-\d{2}$/

const pad = (n: number) => String(n).padStart(2, '0')

export function toYearMonth(iso: string): YearMonth {
  return iso.slice(0, 7)
}

export function currentYearMonth(now: Date = new Date()): YearMonth {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
}

/** 年月を前後に動かす。年またぎは Date に計算させる。 */
export function addMonths(ym: YearMonth, delta: number): YearMonth {
  const [y, m] = ym.split('-').map(Number)
  const moved = new Date(y, m - 1 + delta, 1)
  return `${moved.getFullYear()}-${pad(moved.getMonth() + 1)}`
}

export type CalendarDay = {
  date: string
  /** その月の日か。前後の月から借りてきたマスは false。 */
  inMonth: boolean
}

/**
 * 月のマス目を作る。日曜始まりの 6 週 × 7 日で固定する。
 * 週数を月によって変えると、月を送るたびに下の一覧の位置が動いて読みにくい。
 */
export function monthGrid(ym: YearMonth): CalendarDay[][] {
  const [y, m] = ym.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const start = new Date(y, m - 1, 1 - first.getDay())

  const weeks: CalendarDay[][] = []
  for (let w = 0; w < 6; w++) {
    const week: CalendarDay[] = []
    for (let d = 0; d < 7; d++) {
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d)
      week.push({ date: toISODate(day), inMonth: day.getMonth() === m - 1 })
    }
    weeks.push(week)
  }
  return weeks
}

export const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const

export function formatMonthLabel(ym: YearMonth): string {
  const [y, m] = ym.split('-').map(Number)
  return `${y}年 ${m}月`
}

export function formatDayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const weekday = WEEKDAY_LABELS[new Date(y, m - 1, d).getDay()]
  return `${m}月${d}日(${weekday})`
}

export type DayCount = { total: number; done: number }

/** 日付ごとの件数。マスに印を出すために使う。 */
export function countByDate(todos: Todo[]): Record<string, DayCount> {
  const result: Record<string, DayCount> = {}
  for (const todo of todos) {
    if (todo.dueDate === null) continue
    const entry = result[todo.dueDate] ?? { total: 0, done: 0 }
    entry.total++
    if (todo.done) entry.done++
    result[todo.dueDate] = entry
  }
  return result
}

/**
 * その日のタスク。未完了を先に、時刻の早い順、時刻なしは末尾。
 * 一覧側の並びと違うのは、ここでは「その日の時間割」を見たいため。
 */
export function todosOnDate(todos: Todo[], iso: string): Todo[] {
  return todos
    .filter((todo) => todo.dueDate === iso)
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1
      if (a.dueTime !== b.dueTime) {
        if (a.dueTime === null) return 1
        if (b.dueTime === null) return -1
        return a.dueTime < b.dueTime ? -1 : 1
      }
      return a.createdAt < b.createdAt ? -1 : 1
    })
}

/** 期限が無いタスク。カレンダーではどこにも置けないので、別に数えて知らせる。 */
export function undatedCount(todos: Todo[]): number {
  return todos.filter((todo) => todo.dueDate === null && !todo.done).length
}
