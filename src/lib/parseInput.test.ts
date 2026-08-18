import { describe, expect, it } from 'vitest'
import { parseInput } from './parseInput'

// 2026-08-18 は火曜日。
const TODAY = '2026-08-18'
const cats = [
  { id: 'c1', name: '仕事', color: 'blue' as const, updatedAt: '' },
  { id: 'c2', name: '学習', color: 'purple' as const, updatedAt: '' },
]
const p = (text: string) => parseInput(text, TODAY, cats)

describe('1行入力の解釈', () => {
  it('何も無ければ題名だけ', () => {
    expect(p('請求書を出す')).toEqual({
      title: '請求書を出す', dueDate: null, dueTime: null,
      categoryId: null, priority: 'normal', repeat: 'none',
    })
  })

  describe('日付', () => {
    it('今日・明日・明後日', () => {
      expect(p('掃除 今日').dueDate).toBe('2026-08-18')
      expect(p('掃除 明日').dueDate).toBe('2026-08-19')
      expect(p('掃除 明後日').dueDate).toBe('2026-08-20')
    })

    it('曜日は次に来るその曜日', () => {
      // 火曜日なので、金曜は 3 日後
      expect(p('会議 金曜').dueDate).toBe('2026-08-21')
      // 同じ曜日を指したら来週（今日を指すと期限の意味が薄い）
      expect(p('会議 火曜').dueDate).toBe('2026-08-25')
    })

    it('来週◯曜', () => {
      expect(p('提出 来週月曜').dueDate).toBe('2026-08-24')
    })

    it('来週だけなら 7 日後', () => {
      expect(p('連絡 来週').dueDate).toBe('2026-08-25')
    })

    it('月日を指定できる', () => {
      expect(p('申込 10/6').dueDate).toBe('2026-10-06')
      expect(p('申込 10月6日').dueDate).toBe('2026-10-06')
    })

    it('過ぎている月日は来年として読む', () => {
      expect(p('申込 1/27').dueDate).toBe('2027-01-27')
    })

    it('日だけなら今月か来月', () => {
      expect(p('家賃 25日').dueDate).toBe('2026-08-25')
      expect(p('家賃 5日').dueDate).toBe('2026-09-05')
    })
  })

  describe('時刻', () => {
    it('15時 / 15:00', () => {
      expect(p('会議 明日15時').dueTime).toBe('15:00')
      expect(p('会議 明日 15:30').dueTime).toBe('15:30')
    })

    it('午前・午後', () => {
      expect(p('会議 明日 午後3時').dueTime).toBe('15:00')
      expect(p('会議 明日 午前9時').dueTime).toBe('09:00')
    })

    it('時刻だけなら今日として扱う', () => {
      const r = p('電話 18時')
      expect(r.dueDate).toBe('2026-08-18')
      expect(r.dueTime).toBe('18:00')
    })
  })

  describe('繰り返し', () => {
    it('毎日・毎週・毎月', () => {
      expect(p('薬 毎日').repeat).toBe('daily')
      expect(p('ゴミ 毎週').repeat).toBe('weekly')
      expect(p('家賃 毎月').repeat).toBe('monthly')
    })

    it('繰り返しは期限を伴う（今日を既定にする）', () => {
      expect(p('薬 毎日').dueDate).toBe('2026-08-18')
    })

    it('毎週◯曜はその曜日が期限になる', () => {
      const r = p('ゴミ出し 毎週金曜')
      expect(r.repeat).toBe('weekly')
      expect(r.dueDate).toBe('2026-08-21')
    })
  })

  describe('カテゴリ', () => {
    it('#名前 で既存のカテゴリに割り当てる', () => {
      expect(p('資料作り #仕事').categoryId).toBe('c1')
    })

    it('知らないカテゴリは題名に残す', () => {
      const r = p('買い物 #食料')
      expect(r.categoryId).toBeNull()
      expect(r.title).toBe('買い物 #食料')
    })

    it('全角の＃も拾う', () => {
      expect(p('復習 ＃学習').categoryId).toBe('c2')
    })
  })

  describe('優先度', () => {
    it('!高 / !低', () => {
      expect(p('申込 !高').priority).toBe('high')
      expect(p('掃除 !低').priority).toBe('low')
    })

    it('!! も高', () => {
      expect(p('申込 !!').priority).toBe('high')
    })
  })

  describe('題名の取り出し', () => {
    it('拾った語は題名から外す', () => {
      expect(p('歯医者 明日15時 #仕事 !高').title).toBe('歯医者')
    })

    it('外した結果が空なら、元の文字列を題名にする', () => {
      // 「明日」しか書かれていなければ、それが題名のつもりだった可能性が高い
      expect(p('明日').title).toBe('明日')
    })

    it('文中の語は消さない', () => {
      // 「明日の準備」の「明日」は日付の指定ではなく題名の一部
      const r = p('明日の準備')
      expect(r.title).toBe('明日の準備')
      expect(r.dueDate).toBeNull()
    })

    it('余分な空白は詰める', () => {
      expect(p('  資料   作り   明日  ').title).toBe('資料 作り')
    })
  })
})

describe('繰り返しの拡張', () => {
  it('平日', () => {
    expect(p('日報 平日').repeat).toBe('weekday')
  })

  it('毎月第2火曜', () => {
    const r = p('資源ごみ 毎月第2火曜')
    expect(r.repeat).toBe('monthly-weekday')
    // 2026-08-11 が 8月の第2火曜。すでに過ぎているので 9月の第2火曜。
    expect(r.dueDate).toBe('2026-09-08')
    expect(r.title).toBe('資源ごみ')
  })

  it('今月ぶんがまだなら今月', () => {
    // 8月の第4金曜は 2026-08-28（今日 8/18 より後）
    expect(p('締め 毎月第4金曜').dueDate).toBe('2026-08-28')
  })

  it('全角の数字も拾う', () => {
    expect(p('会議 毎月第２火曜').repeat).toBe('monthly-weekday')
  })
})
