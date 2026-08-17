// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemePicker } from './ThemePicker'
import { THEMES } from '../lib/themes'

afterEach(cleanup)

function setup(overrides: Partial<Parameters<typeof ThemePicker>[0]> = {}) {
  const onChangeTheme = vi.fn()
  const onChangeAppearance = vi.fn()
  render(
    <ThemePicker
      theme="fluoro"
      appearance="auto"
      resolved="light"
      onChangeTheme={onChangeTheme}
      onChangeAppearance={onChangeAppearance}
      {...overrides}
    />,
  )
  return { onChangeTheme, onChangeAppearance }
}

describe('テーマ選択', () => {
  it('テーマを全部並べる', () => {
    setup()
    const radios = screen.getAllByRole('radio')
    // 明暗 3 つ + テーマ 10 個
    expect(radios).toHaveLength(3 + THEMES.length)
    for (const t of THEMES) expect(screen.getByText(t.name)).toBeTruthy()
  })

  it('選択中のテーマだけ checked になる', () => {
    setup({ theme: 'washi' })
    const group = screen.getByRole('radiogroup', { name: 'テーマ' })
    const checked = [...group.querySelectorAll('[aria-checked="true"]')]
    expect(checked).toHaveLength(1)
    expect(checked[0].textContent).toContain('和紙と藍')
  })

  it('押すとそのテーマを返す', () => {
    const { onChangeTheme } = setup()
    fireEvent.click(screen.getByText('ミッドナイト'))
    expect(onChangeTheme).toHaveBeenCalledWith('midnight')
  })

  it('明暗を押すと返す', () => {
    const { onChangeAppearance } = setup()
    fireEvent.click(screen.getByText('ダーク'))
    expect(onChangeAppearance).toHaveBeenCalledWith('dark')
  })

  it('矢印キーで隣のテーマへ移れる', () => {
    const { onChangeTheme } = setup({ theme: 'fluoro' })
    const group = screen.getByRole('radiogroup', { name: 'テーマ' })
    fireEvent.keyDown(group, { key: 'ArrowRight' })
    expect(onChangeTheme).toHaveBeenCalledWith(THEMES[1].id)
  })

  it('端で矢印キーを押すと反対の端へ回る', () => {
    const { onChangeTheme } = setup({ theme: 'fluoro' })
    const group = screen.getByRole('radiogroup', { name: 'テーマ' })
    fireEvent.keyDown(group, { key: 'ArrowLeft' })
    expect(onChangeTheme).toHaveBeenCalledWith(THEMES[THEMES.length - 1].id)
  })

  it('見本にはそのテーマの属性が付く（現在のテーマを引き継がない）', () => {
    const { container } = render(
      <ThemePicker
        theme="fluoro"
        appearance="light"
        resolved="light"
        onChangeTheme={vi.fn()}
        onChangeAppearance={vi.fn()}
      />,
    )
    const previews = [...container.querySelectorAll('.theme-preview')]
    expect(previews.map((el) => el.getAttribute('data-theme'))).toEqual(THEMES.map((t) => t.id))
  })

  it('自動のときだけ、いまどちらかを知らせる', () => {
    setup({ appearance: 'auto', resolved: 'dark' })
    expect(screen.getByText(/端末の設定に合わせています（いまはダーク）/)).toBeTruthy()
    cleanup()
    setup({ appearance: 'light' })
    expect(screen.queryByText(/端末の設定に合わせています/)).toBeNull()
  })
})
