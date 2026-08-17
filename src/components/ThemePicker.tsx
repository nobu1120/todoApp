import { APPEARANCES, THEMES, type Appearance, type ThemeId } from '../lib/themes'

type Props = {
  theme: ThemeId
  appearance: Appearance
  /** 'auto' のとき、いま実際に適用されているのはどちらか。 */
  resolved: 'light' | 'dark'
  onChangeTheme: (theme: ThemeId) => void
  onChangeAppearance: (appearance: Appearance) => void
}

export function ThemePicker({
  theme,
  appearance,
  resolved,
  onChangeTheme,
  onChangeAppearance,
}: Props) {
  return (
    <>
      <div className="segmented" role="group" aria-label="明るさ">
        {APPEARANCES.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`segmented__item${appearance === a.id ? ' is-selected' : ''}`}
            aria-pressed={appearance === a.id}
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

      <div className="theme-grid">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`theme-card${theme === t.id ? ' is-selected' : ''}`}
            aria-pressed={theme === t.id}
            onClick={() => onChangeTheme(t.id)}
          >
            {/*
              見本にだけテーマの属性を持たせる。CSS 側のトークンがそのまま効くので、
              テーマを足しても、ここに手を入れる必要はない。
            */}
            <span className="theme-preview" data-theme={t.id} aria-hidden="true">
              <span className="theme-preview__head">
                <span className="theme-preview__aa">Aa</span>
                <span className="theme-preview__chip" />
              </span>
              <span className="theme-preview__row">
                <span className="theme-preview__box" />
                <span className="theme-preview__line" />
              </span>
              <span className="theme-preview__row">
                <span className="theme-preview__box" />
                <span className="theme-preview__line theme-preview__line--short" />
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
