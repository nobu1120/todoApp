/**
 * 日付は「時刻なしのローカル日付」を 'YYYY-MM-DD'、時刻を 'HH:MM' で扱う。
 * ゼロ埋めされた同形式どうしは辞書順比較 = 時系列比較になるため、
 * 前後判定は文字列比較で足りる（タイムゾーンのズレも起きない）。
 */

const pad = (n: number) => String(n).padStart(2, '0')

/** ローカルタイムでの 'YYYY-MM-DD'。 */
export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** ローカルタイムでの 'HH:MM'。 */
export function toHM(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export const HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** 'YYYY-MM-DD'（+ 任意の 'HH:MM'）をローカルタイムの Date に戻す。 */
export function parseISODate(iso: string, time: string | null = null): Date {
  const [y, m, d] = iso.split('-').map(Number)
  if (time === null) return new Date(y, m - 1, d)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm)
}

/** a - b の日数差。同じ日なら 0、a が翌日なら 1。 */
export function diffInDays(a: string, b: string): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  // 0 時どうしの差なので、DST で 23h / 25h になっても四捨五入で正しい日数になる。
  return Math.round((parseISODate(a).getTime() - parseISODate(b).getTime()) / MS_PER_DAY)
}

export function isToday(dueDate: string | null, today: string = todayISO()): boolean {
  return dueDate === today
}

/** 期限切れ = 期限が今日より前。今日ぶんはまだ切れていない扱い。 */
export function isOverdue(dueDate: string | null, today: string = todayISO()): boolean {
  return dueDate !== null && dueDate < today
}

/** 一覧に出す短いラベル。'今日' / '明日' / '昨日' / '8/20' */
export function formatDueLabel(dueDate: string, today: string = todayISO()): string {
  const diff = diffInDays(dueDate, today)
  if (diff === 0) return '今日'
  if (diff === 1) return '明日'
  if (diff === -1) return '昨日'
  const date = parseISODate(dueDate)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

/** 期限の表示。時刻があれば付ける。'今日 18:30' / '8/20' */
export function formatDue(
  dueDate: string,
  dueTime: string | null,
  today: string = todayISO(),
): string {
  const label = formatDueLabel(dueDate, today)
  return dueTime === null ? label : `${label} ${dueTime}`
}
