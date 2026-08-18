import { describe, expect, it } from 'vitest'
import { buildHistory, monthLabels } from './history'
import type { Todo } from '../types'

const TODAY = '2026-08-18' // 火曜
const done = (id: string, completedAt: string | null): Todo => ({
  id, title: id, done: completedAt !== null, dueDate: null, dueTime: null,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  completedAt, icon: '', categoryId: null, notes: '', subtasks: [],
  notifiedAt: null, priority: 'normal', repeat: 'none', spawnedFrom: null, startDate: null, someday: false,
})
const at = (date: string, h = 12) => `${date}T${String(h).padStart(2, '0')}:00:00.000Z`

describe('完了の記録', () => {
  it('週の区切りに揃うので、日数は 7 の倍数', () => {
    const h = buildHistory([], TODAY, 27)
    expect(h.days).toHaveLength(27 * 7)
  })

  it('日曜に始まり土曜に終わる', () => {
    const h = buildHistory([], TODAY, 4)
    expect(new Date(h.days[0].date + 'T00:00:00').getDay()).toBe(0)
    expect(new Date(h.days[h.days.length - 1].date + 'T00:00:00').getDay()).toBe(6)
  })

  it('同じ日の完了をまとめて数える', () => {
    const h = buildHistory([done('a', at('2026-08-17')), done('b', at('2026-08-17'))], TODAY, 4)
    expect(h.days.find((d) => d.date === '2026-08-17')?.count).toBe(2)
    expect(h.total).toBe(2)
  })

  it('未完了は数えない', () => {
    expect(buildHistory([done('a', null)], TODAY, 4).total).toBe(0)
  })

  it('壊れた完了日は捨てる', () => {
    expect(buildHistory([done('a', 'zzz')], TODAY, 4).total).toBe(0)
  })

  it('濃さは「その人の忙しい日」を基準にする', () => {
    const todos = [
      done('a', at('2026-08-17')),
      ...Array.from({ length: 8 }, (_, i) => done(`b${i}`, at('2026-08-16'))),
    ]
    const h = buildHistory(todos, TODAY, 4)
    expect(h.busiest).toBe(8)
    expect(h.days.find((d) => d.date === '2026-08-16')?.level).toBe(4)
    expect(h.days.find((d) => d.date === '2026-08-17')?.level).toBe(1)
    expect(h.days.find((d) => d.date === '2026-08-15')?.level).toBe(0)
  })

  it('連続日数は今日から遡って数える', () => {
    const h = buildHistory(
      [done('a', at('2026-08-18')), done('b', at('2026-08-17')), done('c', at('2026-08-16'))],
      TODAY, 4,
    )
    expect(h.streak).toBe(3)
  })

  it('今日やっていなければ連続は 0', () => {
    expect(buildHistory([done('a', at('2026-08-17'))], TODAY, 4).streak).toBe(0)
  })

  it('最長連続は期間中のどこでもよい', () => {
    const h = buildHistory(
      ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-10']
        .map((d, i) => done(`t${i}`, at(d))),
      TODAY, 8,
    )
    expect(h.bestStreak).toBe(4)
    expect(h.streak).toBe(0)
  })

  it('未来の日を連続に数えない（今週の残りで途切れて見えないように）', () => {
    // 今日は火曜。今週の水〜土はまだ空欄だが、最長連続には影響しない。
    const h = buildHistory([done('a', at('2026-08-18'))], TODAY, 4)
    expect(h.bestStreak).toBe(1)
  })

  it('平均は経過した日数で割る（未来の空欄で薄めない）', () => {
    const h = buildHistory(
      Array.from({ length: 14 }, (_, i) => done(`t${i}`, at('2026-08-17'))),
      TODAY, 2,
    )
    // 2 週 = 14 日ぶんのうち、今日までは 10 日（日〜火 + 前週 7 日）
    const elapsed = h.days.filter((d) => d.date <= TODAY).length
    expect(h.perDay).toBe(Math.round((14 / elapsed) * 10) / 10)
  })

  it('月名は変わり目にだけ出す', () => {
    const h = buildHistory([], TODAY, 27)
    const labels = monthLabels(h.days)
    expect(labels).toHaveLength(27)
    expect(labels.filter((l) => l !== null).length).toBeGreaterThan(3)
    // 同じ月が 2 回続けて出ない
    const shown = labels.filter((l): l is string => l !== null)
    expect(new Set(shown).size).toBe(shown.length)
  })
})
