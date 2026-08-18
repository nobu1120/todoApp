import type { Category, Priority, Repeat } from '../types'
import { addDays, parseISODate, toISODate, todayISO } from './date'

/**
 * 1 行の入力から、期限・繰り返し・分類・優先度を読み取る。
 *
 * 競合（Todoist など）が唯一はっきり速いのは「思いついてから登録し終わるまで」で、
 * その差はここで埋まる。「明日15時 歯医者 #仕事 !高」と打てば欄を分けずに済む。
 *
 * 方針:
 *   - 拾うのは末尾・先頭・空白で区切られた語だけ。文中の語は題名の一部として残す
 *     （「明日の準備」の「明日」を期限にすると、書いた意図と違うものができる）。
 *   - 拾った結果、題名が空になるなら何も拾わなかったことにする
 *     （「明日」とだけ書いたなら、それが題名のつもり）。
 *   - 分からないものは黙って捨てず、題名に残す。
 */

export type ParsedInput = {
  title: string
  dueDate: string | null
  dueTime: string | null
  categoryId: string | null
  priority: Priority
  repeat: Repeat
}

/** 日曜を 0 とする曜日。「日月火水木金土」の順。 */
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

const pad = (n: number) => String(n).padStart(2, '0')

/** today から見て、次にその曜日が来る日。今日と同じ曜日なら 1 週間後。 */
function nextWeekday(today: string, weekday: number): string {
  const current = parseISODate(today).getDay()
  const ahead = (weekday - current + 7) % 7
  return addDays(today, ahead === 0 ? 7 : ahead)
}

/**
 * 語を 1 つずつ見て、拾えたものを取り除く。
 * 取り除いた残りが題名になる。
 */
export function parseInput(
  raw: string,
  today: string = todayISO(),
  categories: readonly Category[] = [],
): ParsedInput {
  const result: ParsedInput = {
    title: raw.trim(),
    dueDate: null,
    dueTime: null,
    categoryId: null,
    priority: 'normal',
    repeat: 'none',
  }

  // 全角の記号は半角に寄せてから見る（＃仕事 / ！高 / １５時）。
  const normalized = raw
    .replace(/[＃]/g, '#')
    .replace(/[！]/g, '!')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[：]/g, ':')
    .replace(/[／]/g, '/')

  const words = normalized.split(/\s+/).filter((w) => w !== '')
  const kept: string[] = []

  // 「毎週金曜」のように、1 語で 2 つの意味を持つものがある。
  // 拾えたかどうかは語ごとに記録し、拾えなかった語だけを題名に戻す。
  for (const word of words) {
    /*
     * 語を丸ごと解釈できたときだけ反映する。
     * 途中まで拾った時点で書き込むと、「明日の準備」の「明日」が期限になり、
     * 題名は元のまま残る（＝書いた覚えのない期限が付く）。
     */
    const draft: ParsedInput = { ...result }
    if (consume(word, draft, today, categories)) {
      Object.assign(result, draft)
      continue
    }
    kept.push(word)
  }

  const title = kept.join(' ').trim()

  // 全部が指定語だった = そもそも指定ではなく題名だった。
  if (title === '') {
    return {
      title: raw.trim().replace(/\s+/g, ' '),
      dueDate: null,
      dueTime: null,
      categoryId: null,
      priority: 'normal',
      repeat: 'none',
    }
  }

  result.title = title

  // 時刻だけ書かれていたら今日のこと。
  if (result.dueTime !== null && result.dueDate === null) result.dueDate = today
  // 繰り返しは期限が無いと回りようがない。既定を今日にする。
  if (result.repeat !== 'none' && result.dueDate === null) result.dueDate = today

  return result
}

/** 語を 1 つ解釈する。拾えたら true。 */
function consume(
  word: string,
  out: ParsedInput,
  today: string,
  categories: readonly Category[],
): boolean {
  let rest = word
  let hit = false

  // --- 繰り返し（毎日 / 毎週 / 毎月 / 毎週金曜）---
  const repeat = rest.match(/^毎(日|週|月)/)
  if (repeat !== null) {
    out.repeat = repeat[1] === '日' ? 'daily' : repeat[1] === '週' ? 'weekly' : 'monthly'
    rest = rest.slice(repeat[0].length)
    hit = true
  }

  // --- 相対日 ---
  const relative: Record<string, number> = { 今日: 0, 明日: 1, 明後日: 2, あさって: 2 }
  for (const [label, offset] of Object.entries(relative)) {
    if (rest.startsWith(label)) {
      out.dueDate = addDays(today, offset)
      rest = rest.slice(label.length)
      hit = true
      break
    }
  }

  // --- 来週 / 来週◯曜 ---
  if (rest.startsWith('来週')) {
    const after = rest.slice(2)
    const day = after.match(/^([日月火水木金土])曜?日?/)
    if (day !== null) {
      // 来週のその曜日 = 次に来るその曜日（同じ曜日なら 1 週後）
      out.dueDate = nextWeekday(today, WEEKDAYS.indexOf(day[1]))
      rest = after.slice(day[0].length)
    } else {
      out.dueDate = addDays(today, 7)
      rest = after
    }
    hit = true
  }

  // --- 曜日（金曜 / 金曜日 / 金）---
  if (out.dueDate === null || out.repeat !== 'none') {
    const day = rest.match(/^([日月火水木金土])曜日?$/)
    if (day !== null) {
      out.dueDate = nextWeekday(today, WEEKDAYS.indexOf(day[1]))
      rest = ''
      hit = true
    }
  }

  // --- 月日（10/6 / 10月6日）---
  const md = rest.match(/^(\d{1,2})(?:\/|月)(\d{1,2})日?$/)
  if (md !== null) {
    const month = Number(md[1])
    const day = Number(md[2])
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const year = parseISODate(today).getFullYear()
      let iso = `${year}-${pad(month)}-${pad(day)}`
      // 過ぎている日付は来年のこと（1 月の申込を 8 月に書くなど）。
      if (iso < today) iso = `${year + 1}-${pad(month)}-${pad(day)}`
      out.dueDate = iso
      rest = ''
      hit = true
    }
  }

  // --- 日だけ（25日）---
  const dayOnly = rest.match(/^(\d{1,2})日$/)
  if (dayOnly !== null) {
    const day = Number(dayOnly[1])
    if (day >= 1 && day <= 31) {
      const base = parseISODate(today)
      const iso = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(day)}`
      // 過ぎていれば来月。
      out.dueDate = iso < today ? toISODate(nextMonthDay(base, day)) : iso
      rest = ''
      hit = true
    }
  }

  // --- 時刻（15時 / 15:30 / 午後3時）---
  const time = rest.match(/^(午前|午後)?(\d{1,2})(?::(\d{2})|時(?:(\d{1,2})分)?)$/)
  if (time !== null) {
    let hour = Number(time[2])
    const minute = Number(time[3] ?? time[4] ?? 0)
    if (time[1] === '午後' && hour < 12) hour += 12
    if (time[1] === '午前' && hour === 12) hour = 0
    if (hour <= 23 && minute <= 59) {
      out.dueTime = `${pad(hour)}:${pad(minute)}`
      rest = ''
      hit = true
    }
  }

  // --- 分類（#仕事）---
  const cat = rest.match(/^#(.+)$/)
  if (cat !== null) {
    const found = categories.find((c) => c.name === cat[1])
    // 知らない分類は勝手に作らない。題名に残して気づけるようにする。
    if (found !== undefined) {
      out.categoryId = found.id
      rest = ''
      hit = true
    }
  }

  // --- 優先度（!高 / !低 / !! / !）---
  const prio = rest.match(/^!(高|低|中|!)?$/)
  if (prio !== null) {
    out.priority = prio[1] === '低' ? 'low' : prio[1] === '中' ? 'normal' : 'high'
    rest = ''
    hit = true
  }

  // 語の一部だけ拾って残りが出たら、拾わなかったことにする
  // （「明日の準備」を「明日」＋「の準備」に割らない）。
  return hit && rest === ''
}

/** その月に day が無ければ末日に丸める（1/31 の翌月など）。 */
function nextMonthDay(base: Date, day: number): Date {
  const year = base.getFullYear()
  const month = base.getMonth() + 1
  const last = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, last))
}
