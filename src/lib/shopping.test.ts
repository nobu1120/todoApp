import { describe, expect, it } from 'vitest'
import { storeReducer } from './todos'
import { CURRENT_VERSION, SHOPPING_MAX, SHOPPING_NAME_MAX, emptyStore, migrate } from './storage'
import type { ShoppingItem, TodoStore } from '../types'

const NOW = '2026-08-18T00:00:00.000Z'
const LATER = '2026-08-19T00:00:00.000Z'

const store = (items: ShoppingItem[] = [], updatedAt = new Date(0).toISOString()): TodoStore => ({
  ...emptyStore,
  categories: [],
  shopping: { items, updatedAt },
})
const item = (id: string, over: Partial<ShoppingItem> = {}): ShoppingItem => ({
  id, name: id, quantity: 1, done: false, ...over,
})

describe('買い物リスト', () => {
  describe('足す', () => {
    it('末尾に足す（書いた順に買い物をするため）', () => {
      const after = storeReducer(store([item('a')]), {
        type: 'shopping:add', name: '牛乳', id: 'b', now: NOW,
      })
      expect(after.shopping.items.map((i) => i.name)).toEqual(['a', '牛乳'])
      expect(after.shopping.updatedAt).toBe(NOW)
    })

    it('個数は 1 から始まる', () => {
      const after = storeReducer(store(), { type: 'shopping:add', name: '卵', id: 'b', now: NOW })
      expect(after.shopping.items[0].quantity).toBe(1)
      expect(after.shopping.items[0].done).toBe(false)
    })

    it('前後の空白を落とす', () => {
      const after = storeReducer(store(), { type: 'shopping:add', name: '  パン  ', id: 'b', now: NOW })
      expect(after.shopping.items[0].name).toBe('パン')
    })

    it('空文字は足さない', () => {
      const before = store()
      expect(storeReducer(before, { type: 'shopping:add', name: '   ', id: 'b', now: NOW })).toBe(before)
    })

    it('名前が長すぎたら切る', () => {
      const after = storeReducer(store(), {
        type: 'shopping:add', name: 'あ'.repeat(SHOPPING_NAME_MAX + 20), id: 'b', now: NOW,
      })
      expect([...after.shopping.items[0].name].length).toBe(SHOPPING_NAME_MAX)
    })

    it('上限を超えたら足さない', () => {
      const full = store(Array.from({ length: SHOPPING_MAX }, (_, i) => item(`i${i}`)))
      expect(storeReducer(full, { type: 'shopping:add', name: '牛乳', id: 'x', now: NOW })).toBe(full)
    })
  })

  describe('個数', () => {
    it('増やせる', () => {
      const after = storeReducer(store([item('a')]), {
        type: 'shopping:quantity', id: 'a', delta: 1, now: NOW,
      })
      expect(after.shopping.items[0].quantity).toBe(2)
    })

    it('減らせるが 1 より下がらない（0 個は「消す」の意味になる）', () => {
      const after = storeReducer(store([item('a')]), {
        type: 'shopping:quantity', id: 'a', delta: -1, now: NOW,
      })
      expect(after.shopping.items[0].quantity).toBe(1)
    })

    it('上限がある', () => {
      const after = storeReducer(store([item('a', { quantity: 99 })]), {
        type: 'shopping:quantity', id: 'a', delta: 1, now: NOW,
      })
      expect(after.shopping.items[0].quantity).toBe(99)
    })

    it('変わらないなら更新時刻も進めない', () => {
      const before = store([item('a')], NOW)
      const after = storeReducer(before, { type: 'shopping:quantity', id: 'a', delta: -1, now: LATER })
      expect(after.shopping.updatedAt).toBe(NOW)
    })
  })

  describe('買ったことにする', () => {
    it('印を付け外しできる', () => {
      const on = storeReducer(store([item('a')]), { type: 'shopping:toggle', id: 'a', now: NOW })
      expect(on.shopping.items[0].done).toBe(true)
      const off = storeReducer(on, { type: 'shopping:toggle', id: 'a', now: LATER })
      expect(off.shopping.items[0].done).toBe(false)
    })

    it('並びは変えない（棚の順に書いた並びを崩さない）', () => {
      const after = storeReducer(store([item('a'), item('b'), item('c')]), {
        type: 'shopping:toggle', id: 'a', now: NOW,
      })
      expect(after.shopping.items.map((i) => i.id)).toEqual(['a', 'b', 'c'])
    })
  })

  describe('消す', () => {
    it('1 つ消せる', () => {
      const after = storeReducer(store([item('a'), item('b')]), {
        type: 'shopping:remove', id: 'a', now: NOW,
      })
      expect(after.shopping.items.map((i) => i.id)).toEqual(['b'])
    })

    it('買ったものだけまとめて消せる', () => {
      const after = storeReducer(
        store([item('a', { done: true }), item('b'), item('c', { done: true })]),
        { type: 'shopping:clearDone', now: NOW },
      )
      expect(after.shopping.items.map((i) => i.id)).toEqual(['b'])
    })

    it('買ったものが無ければ何もしない', () => {
      const before = store([item('a')], NOW)
      expect(storeReducer(before, { type: 'shopping:clearDone', now: LATER })).toBe(before)
    })
  })

  describe('読み込み', () => {
    it('古いデータには無いので空で始まる', () => {
      const s = migrate({ schemaVersion: 9, todos: [], categories: [], tombstones: [] })
      expect(s.shopping.items).toEqual([])
    })

    it('壊れた行は捨てて、正しい行は残す', () => {
      const s = migrate({
        schemaVersion: CURRENT_VERSION, todos: [], categories: [], tombstones: [],
        shopping: { updatedAt: NOW, items: [
          { id: 'ok', name: '牛乳', quantity: 3, done: true },
          { id: 'noname', quantity: 1 },
          'ごみ',
          { id: 'badqty', name: '卵', quantity: -5, done: false },
        ] },
      })
      expect(s.shopping.items.map((i) => i.id)).toEqual(['ok', 'badqty'])
      expect(s.shopping.items[0].quantity).toBe(3)
      // 壊れた個数は 1 に丸める
      expect(s.shopping.items[1].quantity).toBe(1)
    })

    it('多すぎたら切る', () => {
      const items = Array.from({ length: SHOPPING_MAX + 30 }, (_, i) => ({
        id: `i${i}`, name: 'x', quantity: 1, done: false,
      }))
      const s = migrate({
        schemaVersion: CURRENT_VERSION, todos: [], categories: [], tombstones: [],
        shopping: { updatedAt: NOW, items },
      })
      expect(s.shopping.items).toHaveLength(SHOPPING_MAX)
    })
  })
})
