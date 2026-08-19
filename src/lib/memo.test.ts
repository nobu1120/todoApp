import { describe, expect, it } from 'vitest'
import { MEMO_MAX, clampMemo, memoLength, migrate } from './storage'
import { storeReducer } from './todos'
import { emptyStore } from './storage'

const NOW = '2026-08-18T00:00:00.000Z'

describe('メモの上限', () => {
  it('上限は 500 文字', () => {
    expect(MEMO_MAX).toBe(500)
  })

  it('上限までは切らない', () => {
    const text = 'あ'.repeat(MEMO_MAX)
    expect(clampMemo(text)).toBe(text)
  })

  it('超えたぶんは切る', () => {
    expect(memoLength(clampMemo('あ'.repeat(MEMO_MAX + 50)))).toBe(MEMO_MAX)
  })

  it('絵文字は 1 文字として数える（見た目と合わせる）', () => {
    // '🐈' は UTF-16 では 2 単位。length では 2 と数えられてしまう。
    expect('🐈'.length).toBe(2)
    expect(memoLength('🐈')).toBe(1)
    expect(memoLength('🐈'.repeat(10))).toBe(10)
  })

  it('絵文字を途中で割らない', () => {
    const text = '🐈'.repeat(MEMO_MAX + 10)
    const clamped = clampMemo(text)
    expect(memoLength(clamped)).toBe(MEMO_MAX)
    // 壊れた片割れ（サロゲート）が残っていない
    expect(clamped).toBe('🐈'.repeat(MEMO_MAX))
  })

  it('保存のときも上限を掛ける（画面だけで止めない）', () => {
    const after = storeReducer(
      { ...emptyStore, categories: [] },
      { type: 'memo:update', text: 'あ'.repeat(600), now: NOW },
    )
    expect(memoLength(after.memo.text)).toBe(MEMO_MAX)
  })

  it('読み込みのときも上限を掛ける（同期・取り込み経由で超えられない）', () => {
    const store = migrate({
      schemaVersion: 8,
      todos: [],
      categories: [],
      tombstones: [],
      memo: { text: 'い'.repeat(900), updatedAt: NOW },
    })
    expect(memoLength(store.memo.text)).toBe(MEMO_MAX)
  })

  it('中身が同じなら更新時刻を進めない', () => {
    const base = storeReducer(
      { ...emptyStore, categories: [] },
      { type: 'memo:update', text: 'めも', now: NOW },
    )
    const again = storeReducer(base, {
      type: 'memo:update', text: 'めも', now: '2026-08-19T00:00:00.000Z',
    })
    expect(again.memo.updatedAt).toBe(NOW)
  })
})
