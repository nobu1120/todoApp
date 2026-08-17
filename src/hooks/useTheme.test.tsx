// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { useTheme } from './useTheme'
import type { Appearance, ThemeId } from '../lib/themes'

/**
 * jsdom には matchMedia が無い。OS の明暗を差し替えられるスタブを置く。
 * addEventListener しか持たない版と addListener しか持たない版（古い Safari）の
 * 両方を作れるようにしておく。
 */
function stubMatchMedia(dark: boolean, legacy = false) {
  const listeners = new Set<() => void>()
  const mq = {
    matches: dark,
    media: '(prefers-color-scheme: dark)',
    ...(legacy
      ? {
          addListener: (fn: () => void) => listeners.add(fn),
          removeListener: (fn: () => void) => listeners.delete(fn),
        }
      : {
          addEventListener: (_: string, fn: () => void) => listeners.add(fn),
          removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
        }),
  }
  vi.stubGlobal('matchMedia', () => mq)
  return {
    set(next: boolean) {
      mq.matches = next
      listeners.forEach((fn) => fn())
    },
    listenerCount: () => listeners.size,
  }
}

function Probe({ theme, appearance }: { theme: ThemeId; appearance: Appearance }) {
  const resolved = useTheme(theme, appearance)
  return <span data-testid="resolved">{resolved}</span>
}

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('data-appearance')
  document.head.innerHTML = '<meta name="theme-color" content="#ffffff">'
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useTheme', () => {
  it('選んだテーマと明暗を <html> に書き込む', () => {
    stubMatchMedia(false)
    render(<Probe theme="washi" appearance="dark" />)
    expect(document.documentElement.dataset.theme).toBe('washi')
    expect(document.documentElement.dataset.appearance).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('自動なら端末の設定に従う', () => {
    stubMatchMedia(true)
    const { getByTestId } = render(<Probe theme="fluoro" appearance="auto" />)
    expect(getByTestId('resolved').textContent).toBe('dark')
    expect(document.documentElement.dataset.appearance).toBe('dark')
  })

  it('自動のとき、OS の切り替えに追従する', () => {
    const media = stubMatchMedia(false)
    const { getByTestId } = render(<Probe theme="fluoro" appearance="auto" />)
    expect(getByTestId('resolved').textContent).toBe('light')

    act(() => media.set(true))
    expect(getByTestId('resolved').textContent).toBe('dark')
    expect(document.documentElement.dataset.appearance).toBe('dark')
  })

  it('明示した指定は OS より優先する', () => {
    const media = stubMatchMedia(true)
    const { getByTestId } = render(<Probe theme="fluoro" appearance="light" />)
    expect(getByTestId('resolved').textContent).toBe('light')
    act(() => media.set(false))
    expect(getByTestId('resolved').textContent).toBe('light')
  })

  it('外したら購読も解除する', () => {
    const media = stubMatchMedia(false)
    const { unmount } = render(<Probe theme="fluoro" appearance="auto" />)
    expect(media.listenerCount()).toBe(1)
    unmount()
    expect(media.listenerCount()).toBe(0)
  })

  it('addEventListener が無い古いブラウザでも落ちない', () => {
    // 以前ここで TypeError になり、アプリ全体が空白になっていた。
    const media = stubMatchMedia(true, true)
    expect(() => render(<Probe theme="fluoro" appearance="auto" />)).not.toThrow()
    expect(document.documentElement.dataset.appearance).toBe('dark')
    expect(media.listenerCount()).toBe(1)
  })

  it('matchMedia 自体が無くても落ちない', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(() => render(<Probe theme="mono" appearance="auto" />)).not.toThrow()
    expect(document.documentElement.dataset.theme).toBe('mono')
  })

  it('アドレスバーの色を地色に合わせる', () => {
    stubMatchMedia(false)
    // jsdom は CSS ファイルを読まないので、値を直接置いて追従を見る。
    document.documentElement.style.setProperty('--bg', '#0f1117')
    render(<Probe theme="midnight" appearance="dark" />)
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      '#0f1117',
    )
  })
})
