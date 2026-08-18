import { describe, expect, it } from 'vitest'
import {
  DEFAULT_APPEARANCE,
  DEFAULT_THEME,
  THEMES,
  THEME_IDS,
  isAppearance,
  isThemeId,
  isDarkOnly,
  resolveAppearance,
} from './themes'
import { migrate } from './storage'
// CSS を文字列として読む（vite の ?raw）。node の fs に頼らずに済む。
import css from '../index.css?raw'

describe('テーマの一覧', () => {
  it('10 種類ある', () => {
    expect(THEME_IDS).toHaveLength(10)
    expect(THEMES).toHaveLength(10)
  })

  it('id が重複していない', () => {
    expect(new Set(THEME_IDS).size).toBe(THEME_IDS.length)
  })

  it('表示用の一覧と id の一覧が一致する', () => {
    expect(THEMES.map((t) => t.id)).toEqual([...THEME_IDS])
  })

  it('既定のテーマは一覧に含まれる', () => {
    expect(THEME_IDS).toContain(DEFAULT_THEME)
  })
})

describe('値の検証', () => {
  it('知っている id だけ通す', () => {
    expect(isThemeId('washi')).toBe(true)
    // 除いた案（カンバン）や、消えたテーマ名は通さない。
    expect(isThemeId('kanban')).toBe(false)
    expect(isThemeId('')).toBe(false)
    expect(isThemeId(null)).toBe(false)
    expect(isThemeId(3)).toBe(false)
  })

  it('明暗は 3 値だけ通す', () => {
    expect(isAppearance('auto')).toBe(true)
    expect(isAppearance('light')).toBe(true)
    expect(isAppearance('dark')).toBe(true)
    expect(isAppearance('system')).toBe(false)
    expect(isAppearance(undefined)).toBe(false)
  })
})

describe('明暗の決定', () => {
  it('明示された指定は端末の設定より優先する', () => {
    expect(resolveAppearance('light', true)).toBe('light')
    expect(resolveAppearance('dark', false)).toBe('dark')
  })

  it('自動なら端末の設定に従う', () => {
    expect(resolveAppearance('auto', true)).toBe('dark')
    expect(resolveAppearance('auto', false)).toBe('light')
  })
})

describe('保存データからの復元', () => {
  it('テーマが無い古いデータは既定に落ちる', () => {
    const store = migrate({ todos: [], settings: { notificationsEnabled: true } })
    expect(store.settings.theme).toBe(DEFAULT_THEME)
    expect(store.settings.appearance).toBe(DEFAULT_APPEARANCE)
  })

  it('保存されたテーマは読み戻す', () => {
    const store = migrate({
      todos: [],
      settings: { theme: 'midnight', appearance: 'dark' },
    })
    expect(store.settings.theme).toBe('midnight')
    expect(store.settings.appearance).toBe('dark')
  })

  it('知らないテーマ名は既定に落とす（消したテーマを指したままでも壊れない）', () => {
    const store = migrate({ todos: [], settings: { theme: 'kanban', appearance: 'sepia' } })
    expect(store.settings.theme).toBe(DEFAULT_THEME)
    expect(store.settings.appearance).toBe(DEFAULT_APPEARANCE)
  })
})

/**
 * themes.ts に id を足して CSS を書き忘れると、そのテーマを選んだ瞬間に
 * 全トークンが未定義になり、画面が素の白黒になる。isThemeId は通ってしまうので
 * 既定へのフォールバックも効かない。ここで機械的に対応を守る。
 */
describe('CSS との対応', () => {
  /** そのセレクタのブロックの中身を取り出す。 */
  const blockFor = (selector: string): string | null => {
    const at = css.indexOf(selector)
    if (at === -1) return null
    const open = css.indexOf('{', at)
    const close = css.indexOf('}', open)
    return open === -1 || close === -1 ? null : css.slice(open + 1, close)
  }

  const REQUIRED = [
    '--bg',
    '--surface',
    '--surface-2',
    '--border',
    '--border-strong',
    '--text',
    '--text-muted',
    '--accent',
    '--accent-ink',
    '--alert-bg',
    '--alert-fg',
    '--today-bg',
    '--today-fg',
  ]

  it.each(THEME_IDS)('%s にライトの定義がある', (id) => {
    const block = blockFor(`[data-theme='${id}'] {`)
    expect(block).not.toBeNull()
    for (const token of REQUIRED) expect(block).toContain(`${token}:`)
  })

  it.each(THEME_IDS)('%s にダークの定義がある', (id) => {
    // 見本カード用のセレクタと 2 本立てで書いてあるので、後ろ側を目印にする。
    const block = blockFor(`[data-appearance='dark'] [data-theme='${id}'] {`)
    expect(block).not.toBeNull()
    for (const token of REQUIRED) expect(block).toContain(`${token}:`)
  })

  it('CSS に、一覧に無いテーマの定義が残っていない', () => {
    const defined = [...css.matchAll(/\[data-theme='([a-z-]+)'\]/g)].map((m) => m[1])
    for (const id of new Set(defined)) expect(THEME_IDS).toContain(id)
  })
})

describe('ダーク専用のテーマ', () => {
  it('ミッドナイトはダーク専用', () => {
    expect(isDarkOnly('midnight')).toBe(true)
    expect(isDarkOnly('fluoro')).toBe(false)
  })

  it('明暗にライトを選んでもダークのまま', () => {
    expect(resolveAppearance('light', false, 'midnight')).toBe('dark')
    expect(resolveAppearance('auto', false, 'midnight')).toBe('dark')
  })

  it('ほかのテーマは今までどおり', () => {
    expect(resolveAppearance('light', true, 'fluoro')).toBe('light')
    expect(resolveAppearance('auto', false, 'glass')).toBe('light')
  })
})

describe('テーマの名前', () => {
  it('3 列のカードで折り返さない長さに収まっている', () => {
    for (const t of THEMES) expect(t.name.length).toBeLessThanOrEqual(7)
  })
})
