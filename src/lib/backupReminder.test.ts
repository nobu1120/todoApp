import { describe, expect, it } from 'vitest'
import { backupPrompt, snoozeUntil, type BackupState } from './backupReminder'

const NOW = '2026-08-18T00:00:00.000Z'
const daysAgo = (n: number) =>
  new Date(Date.parse(NOW) - n * 24 * 60 * 60 * 1000).toISOString()

const state = (over: Partial<BackupState> = {}): BackupState => ({
  lastBackupAt: null,
  firstRunAt: daysAgo(1),
  snoozedUntil: null,
  ...over,
})

describe('控えの書き出しを促すか', () => {
  it('タスクが少ないうちは言わない', () => {
    expect(backupPrompt(state({ firstRunAt: daysAgo(365) }), 4, NOW).show).toBe(false)
  })

  it('使い始めたばかりなら言わない', () => {
    expect(backupPrompt(state({ firstRunAt: daysAgo(3) }), 20, NOW).show).toBe(false)
  })

  it('一度も書き出さずに 14 日経ったら言う', () => {
    const r = backupPrompt(state({ firstRunAt: daysAgo(14) }), 20, NOW)
    expect(r.show).toBe(true)
    expect(r.never).toBe(true)
  })

  it('書き出したあとは、60 日経つまで言わない', () => {
    const base = state({ lastBackupAt: daysAgo(59), firstRunAt: daysAgo(365) })
    expect(backupPrompt(base, 20, NOW).show).toBe(false)
    expect(backupPrompt({ ...base, lastBackupAt: daysAgo(60) }, 20, NOW).show).toBe(true)
  })

  it('放置日数を返す', () => {
    expect(backupPrompt(state({ lastBackupAt: daysAgo(75) }), 20, NOW).days).toBe(75)
  })

  it('「あとで」のあいだは黙る', () => {
    const base = state({ firstRunAt: daysAgo(365) })
    const snoozed = { ...base, snoozedUntil: new Date(Date.parse(NOW) + 1000).toISOString() }
    expect(backupPrompt(snoozed, 20, NOW).show).toBe(false)
    // 期限が切れたら言う
    const expired = { ...base, snoozedUntil: daysAgo(1) }
    expect(backupPrompt(expired, 20, NOW).show).toBe(true)
  })

  it('あとで は 30 日', () => {
    expect(snoozeUntil(NOW)).toBe('2026-09-17T00:00:00.000Z')
  })

  it('時計が巻き戻っていても言わない（負の日数で暴発させない）', () => {
    const future = state({ lastBackupAt: '2027-01-01T00:00:00.000Z', firstRunAt: daysAgo(365) })
    expect(backupPrompt(future, 20, NOW).show).toBe(false)
  })
})
