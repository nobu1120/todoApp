import { describe, expect, it } from 'vitest'
import {
  DEFAULT_APPEARANCE,
  DEFAULT_THEME,
  THEMES,
  THEME_IDS,
  isAppearance,
  isThemeId,
  resolveAppearance,
} from './themes'
import { migrate } from './storage'

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
