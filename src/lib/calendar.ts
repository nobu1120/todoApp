import type { Todo } from '../types'
import { addDays, toISODate } from './date'

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

export type DayCount = {
  total: number
  done: number
  /** 着手日〜期限の途中にあたる日。期限の日そのものとは区別する。 */
  span?: boolean
}

/**
 * その日が「着手日から期限までの途中」にあたるか。
 *
 * 期限の日にしか印が付かないと、いつから手を付けられるのかが
 * カレンダーから読み取れない。両端が決まっているものだけ帯にする。
 */
export function spansDate(todo: Todo, iso: string): boolean {
  if (todo.done) return false
  if (todo.startDate === null || todo.dueDate === null) return false
  return todo.startDate <= iso && iso <= todo.dueDate
}

/** 日付ごとの件数。マスに印を出すために使う。 */
export function countByDate(todos: Todo[]): Record<string, DayCount> {
  const result: Record<string, DayCount> = {}
  const touch = (iso: string) => (result[iso] ??= { total: 0, done: 0 })

  for (const todo of todos) {
    if (todo.dueDate === null) continue

    // 件数は期限の日だけで数える。帯の途中まで数えると、
    // 1 件のタスクが 30 日ぶんの件数に化ける。
    const entry = touch(todo.dueDate)
    entry.total++
    if (todo.done) entry.done++

    // 帯の途中には印だけ立てる。
    if (todo.startDate === null || todo.done) continue
    for (let iso = todo.startDate; iso < todo.dueDate; iso = addDays(iso, 1)) {
      touch(iso).span = true
    }
    touch(todo.dueDate).span = true
  }
  return result
}

/**
 * その日のタスク。未完了を先に、時刻の早い順、時刻なしは末尾。
 * 一覧側の並びと違うのは、ここでは「その日の時間割」を見たいため。
 */
export function todosOnDate(todos: Todo[], iso: string): Todo[] {
  return todos
    // 期限の日に加えて、着手日〜期限の途中の日にも出す
    // （「今日これに手を付けられる」が分かるように）。
    .filter((todo) => todo.dueDate === iso || spansDate(todo, iso))
    .sort((a, b) => {
      // その日が期限のものを先に。帯の途中より締切のほうが強い。
      const aDue = a.dueDate === iso
      const bDue = b.dueDate === iso
      if (aDue !== bDue) return aDue ? -1 : 1
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
