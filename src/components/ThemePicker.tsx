import { useRef, type KeyboardEvent } from 'react'
import { APPEARANCES, THEMES, type Appearance, type ThemeId } from '../lib/themes'

type Props = {
  theme: ThemeId
  appearance: Appearance
  /** 'auto' のとき、いま実際に適用されているのはどちらか。 */
  resolved: 'light' | 'dark'
  onChangeTheme: (theme: ThemeId) => void
  onChangeAppearance: (appearance: Appearance) => void
}

/**
 * 排他選択なので radiogroup として組む。ボタン + aria-pressed だと
 * 読み上げが「オン / オフ」の羅列になり、10 個並んだときに何番目か分からない。
 * radio を名乗る以上、矢印キーでの移動も自前で用意する。
 */
function useRovingFocus<T>(items: readonly T[], current: T, onSelect: (item: T) => void) {
  const ref = useRef<HTMLDivElement>(null)

  return {
    ref,
    onKeyDown: (event: KeyboardEvent) => {
      const step =
        event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? 1
          : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
            ? -1
            : 0
      if (step === 0) return
      event.preventDefault()
      const at = items.indexOf(current)
      const next = items[(at + step + items.length) % items.length]
      onSelect(next)
      // 選択とフォーカスを一致させる。radio はフォーカスの移動が選択と同義。
      const buttons = ref.current?.querySelectorAll<HTMLElement>('[role="radio"]')
      buttons?.[(at + step + items.length) % items.length]?.focus()
    },
  }
}

export function ThemePicker({
  theme,
  appearance,
  resolved,
  onChangeTheme,
  onChangeAppearance,
}: Props) {
  const appearanceIds = APPEARANCES.map((a) => a.id)
  const themeIds = THEMES.map((t) => t.id)
  const appearanceKeys = useRovingFocus(appearanceIds, appearance, onChangeAppearance)
  const themeKeys = useRovingFocus(themeIds, theme, onChangeTheme)

  return (
    <>
      <div
        className="segmented"
        role="radiogroup"
        aria-label="明るさ"
        ref={appearanceKeys.ref}
        onKeyDown={appearanceKeys.onKeyDown}
      >
        {APPEARANCES.map((a) => (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={appearance === a.id}
            tabIndex={appearance === a.id ? 0 : -1}
            className={`segmented__item${appearance === a.id ? ' is-selected' : ''}`}
            onClick={() => onChangeAppearance(a.id)}
          >
            {a.label}
          </button>
        ))}
      </div>

      {appearance === 'auto' && (
        <p className="detail__hint">
          端末の設定に合わせています（いまは{resolved === 'dark' ? 'ダーク' : 'ライト'}）。
        </p>
      )}

      <div
        className="theme-grid"
        role="radiogroup"
        aria-label="テーマ"
        ref={themeKeys.ref}
        onKeyDown={themeKeys.onKeyDown}
      >
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={theme === t.id}
            tabIndex={theme === t.id ? 0 : -1}
            className={`theme-card${theme === t.id ? ' is-selected' : ''}`}
            onClick={() => onChangeTheme(t.id)}
          >
            {/*
              見本にだけテーマの属性を持たせる。CSS 側のトークンがそのまま効くので、
              テーマを足しても、ここに手を入れる必要はない。
              中身は実際の画面の縮小版にしてある（残り件数の大きさ・期限バッジの色は、
              テーマによって印象が大きく変わるのに、色見本だけでは伝わらないため）。
            */}
            <span className="theme-preview" data-theme={t.id} aria-hidden="true">
              <span className="theme-preview__head">
                <span className="theme-preview__count">
                  残り<b>3</b>
                </span>
              </span>
              <span className="theme-preview__row">
                <span className="theme-preview__box" />
                <span className="theme-preview__line" />
                <span className="theme-preview__badge theme-preview__badge--alert" />
              </span>
              <span className="theme-preview__row">
                <span className="theme-preview__box" />
                <span className="theme-preview__line theme-preview__line--short" />
                <span className="theme-preview__badge theme-preview__badge--today" />
              </span>
            </span>
            <span className="theme-card__name">{t.name}</span>
            <span className="theme-card__note">{t.note}</span>
          </button>
        ))}
      </div>
    </>
  )
}
