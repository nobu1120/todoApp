import { useEffect, useState } from 'react'
import { resolveAppearance, type Appearance, type ThemeId } from '../lib/themes'

const DARK_QUERY = '(prefers-color-scheme: dark)'

/** OS 側の明暗指定。'auto' のときだけ効く。 */
function useSystemDark(): boolean {
  const [dark, setDark] = useState(
    () => typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches,
  )

  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia(DARK_QUERY)
    const onChange = () => setDark(mq.matches)
    // 初回に取り直す。マウントまでに OS 側が変わっている場合がある。
    onChange()

    // addEventListener は Safari 14 から。それ以前は addListener しか無く、
    // 素で呼ぶと TypeError でアプリ全体が落ちる。
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    }
    mq.addListener(onChange)
    return () => mq.removeListener(onChange)
  }, [])

  return dark
}

/**
 * 選んだテーマと明暗を <html> の属性として流し込む。
 * CSS は [data-theme] / [data-appearance] だけを見ればよくなる。
 */
export function useTheme(theme: ThemeId, appearance: Appearance): 'light' | 'dark' {
  const systemDark = useSystemDark()
  const resolved = resolveAppearance(appearance, systemDark)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.dataset.appearance = resolved
    // フォームの既定色（select の矢印など）をテーマ側に合わせる。
    root.style.colorScheme = resolved

    // アドレスバーの色。実際に適用された背景を読んで合わせる。
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta !== null) {
      const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
      if (bg !== '') meta.setAttribute('content', bg)
    }
  }, [theme, resolved])

  return resolved
}
