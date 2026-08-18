import type { Todo } from '../types'
import { addDays, parseISODate, toISODate } from './date'

/**
 * 完了の記録を「地図」にするための集計。
 *
 * 何をやったかではなく、どれだけ動いたかを見せる。
 * Todo アプリが捨てられる一番の理由は「効果が見えない」ことなので、
 * 続ける理由をここで作る。
 *
 * 記録は completedAt だけから作る。新しく保存する項目は無い。
 */

export type DayCount = {
  /** 'YYYY-MM-DD' */
  date: string
  count: number
  /** 0〜4。0 は何もしていない日。見た目の濃さに使う。 */
  level: number
}

export type History = {
  /** 古い順。weeks * 7 日ぶん、日曜始まりで隙間なく並ぶ。 */
  days: DayCount[]
  total: number
  /** 今日まで続いている連続日数。 */
  streak: number
  /** 期間中の最長連続日数。 */
  bestStreak: number
  /** 1 日あたりの平均（動いた日だけで割らない）。 */
  perDay: number
  /** 最も多かった日の件数。濃さの基準。 */
  busiest: number
}

/** 件数を 0〜4 の濃さに落とす。上限は「その人の忙しい日」に合わせる。 */
function levelOf(count: number, busiest: number): number {
  if (count === 0) return 0
  if (busiest <= 1) return 4
  const ratio = count / busiest
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

/**
 * 直近 weeks 週ぶんの記録を作る。
 * 日曜始まりに揃えるので、先頭は today の週の日曜から遡った日になる。
 */
export function buildHistory(todos: Todo[], today: string, weeks = 27): History {
  const counts = new Map<string, number>()
  for (const todo of todos) {
    if (todo.completedAt === null) continue
    const ms = Date.parse(todo.completedAt)
    if (Number.isNaN(ms)) continue
    const date = toISODate(new Date(ms))
    counts.set(date, (counts.get(date) ?? 0) + 1)
  }

  // 今週の土曜まで描き、そこから weeks 週ぶん遡る。
  const end = addDays(today, 6 - parseISODate(today).getDay())
  const start = addDays(end, -(weeks * 7 - 1))

  const days: DayCount[] = []
  let busiest = 0
  for (let iso = start; iso <= end; iso = addDays(iso, 1)) {
    const count = counts.get(iso) ?? 0
    if (count > busiest) busiest = count
    days.push({ date: iso, count, level: 0 })
  }
  for (const day of days) day.level = levelOf(day.count, busiest)

  const total = days.reduce((sum, d) => sum + d.count, 0)

  // 連続日数。未来の日は数えない（今週の残りは空欄なので途切れて見えてしまう）。
  let streak = 0
  for (let iso = today; iso >= start; iso = addDays(iso, -1)) {
    if ((counts.get(iso) ?? 0) === 0) break
    streak++
  }

  let bestStreak = 0
  let run = 0
  for (const day of days) {
    if (day.date > today) break
    run = day.count > 0 ? run + 1 : 0
    if (run > bestStreak) bestStreak = run
  }

  const elapsed = days.filter((d) => d.date <= today).length
  return {
    days,
    total,
    streak,
    bestStreak,
    perDay: elapsed === 0 ? 0 : Math.round((total / elapsed) * 10) / 10,
    busiest,
  }
}

/** 列（週）の先頭に出す月名。同じ月が続くところは空にする。 */
export function monthLabels(days: DayCount[]): (string | null)[] {
  const labels: (string | null)[] = []
  let previous = ''
  for (let i = 0; i < days.length; i += 7) {
    const month = days[i].date.slice(5, 7)
    if (month === previous) labels.push(null)
    else {
      labels.push(`${Number(month)}月`)
      previous = month
    }
  }
  return labels
}
