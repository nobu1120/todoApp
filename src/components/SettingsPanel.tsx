import { useState, type FormEvent } from 'react'
import type { Category, CategoryColor, Settings, TodoStore } from '../types'
import type { PermissionState } from '../lib/notify'
import { CATEGORY_COLORS } from '../lib/categories'
import { Icon } from './Icon'
import { ThemePicker } from './ThemePicker'
import { DataPanel } from './DataPanel'
import { staleTodos } from '../lib/todos'
import { THEMES } from '../lib/themes'

type Props = {
  settings: Settings
  permission: PermissionState
  categories: Category[]
  categoryUsage: Record<string, number>
  /** 'auto' を畳んだ結果。いまライトかダークかの表示に使う。 */
  resolvedAppearance: 'light' | 'dark'
  store: TodoStore
  onImport: (incoming: TodoStore) => number
  onExported?: () => void
  /** ログイン済みかどうか。閉じている間の通知にはログインが要る。 */
  signedIn: boolean
  pushReady: boolean
  onUpdateSettings: (patch: Partial<Settings>) => void
  onEnableNotifications: () => Promise<PermissionState>
  onRegisterPush: () => Promise<boolean>
  onAddCategory: (name: string, color: CategoryColor) => void
  onUpdateCategory: (id: string, patch: Partial<Omit<Category, 'id'>>) => void
  onRemoveCategory: (id: string) => void
}

export function SettingsPanel({
  settings,
  permission,
  categories,
  categoryUsage,
  resolvedAppearance,
  store,
  onImport,
  onExported,
  signedIn,
  pushReady,
  onUpdateSettings,
  onEnableNotifications,
  onRegisterPush,
  onAddCategory,
  onUpdateCategory,
  onRemoveCategory,
}: Props) {
  const [newCategory, setNewCategory] = useState('')
  const [newColor, setNewColor] = useState<CategoryColor>('blue')
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null)

  async function handleToggleNotifications(enabled: boolean) {
    if (!enabled) {
      onUpdateSettings({ notificationsEnabled: false })
      return
    }
    // 許可が未取得なら、ここで初めてブラウザの許可ダイアログを出す。
    const next = permission === 'granted' ? permission : await onEnableNotifications()
    onUpdateSettings({ notificationsEnabled: next === 'granted' })
    // ログイン済みなら、この端末を閉じている間の宛先としても登録する。
    if (next === 'granted' && signedIn) await onRegisterPush()
  }

  function handleAddCategory(event: FormEvent) {
    event.preventDefault()
    if (newCategory.trim() === '') return
    onAddCategory(newCategory, newColor)
    setNewCategory('')
  }

  // 畳んだ見出しに現在値を出す（開かなくても何を選んでいるか分かる）。
  const currentThemeName = THEMES.find((t) => t.id === settings.theme)?.name ?? settings.theme
  const appearanceLabel =
    settings.appearance === 'auto' ? '自動' : settings.appearance === 'dark' ? 'ダーク' : 'ライト'

  return (
    <div className="settings">
      <section className="detail__section">
        <h3 className="detail__label">通知</h3>

        {permission === 'unsupported' ? (
          <p className="detail__hint">このブラウザは通知に対応していません。</p>
        ) : (
          <>
            <label className="switch">
              <input
                className="check check--sm"
                type="checkbox"
                checked={settings.notificationsEnabled && permission === 'granted'}
                onChange={(e) => void handleToggleNotifications(e.target.checked)}
                disabled={permission === 'denied'}
              />
              <span>期限が来たら通知する</span>
            </label>

            {permission === 'denied' && (
              <p className="detail__hint detail__hint--warn">
                ブラウザ側で通知がブロックされています。アドレスバーのサイト設定から許可してください。
              </p>
            )}

            {settings.notificationsEnabled && permission === 'granted' && (
              <p className="detail__hint">
                {!signedIn
                  ? '閉じている間も鳴らすには、右上のログインからサインインしてください。今はアプリを開いている間だけ鳴ります。'
                  : pushReady
                    ? 'この端末は閉じている間の通知先として登録済みです。'
                    : 'この端末はまだ通知先として登録されていません。「この端末で受け取る」を押してください。'}
              </p>
            )}

            {settings.notificationsEnabled && permission === 'granted' && signedIn && !pushReady && (
              <button type="button" onClick={() => void onRegisterPush()}>
                この端末で受け取る
              </button>
            )}

            {settings.notificationsEnabled && permission === 'granted' && (
              <label className="field">
                <span className="field__label">時刻を指定していないタスクの通知時刻</span>
                <input
                  type="time"
                  value={settings.defaultNotifyTime}
                  onChange={(e) => {
                    if (e.target.value !== '') onUpdateSettings({ defaultNotifyTime: e.target.value })
                  }}
                />
              </label>
            )}
          </>
        )}
      </section>

      <section className="detail__section">
        <h3 className="detail__label">カテゴリ</h3>

        <ul className="category-list">
          {categories.map((category) => (
            <li key={category.id} className="category-row" data-color={category.color}>
              <span className="chip__dot" aria-hidden="true" />
              <input
                className="category-row__name"
                value={category.name}
                onChange={(e) => onUpdateCategory(category.id, { name: e.target.value })}
                aria-label={`${category.name} の名前`}
              />
              <select
                className="category-row__color"
                value={category.color}
                onChange={(e) =>
                  onUpdateCategory(category.id, { color: e.target.value as CategoryColor })
                }
                aria-label={`${category.name} の色`}
              >
                {CATEGORY_COLORS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="icon-button"
                onClick={() => setConfirmingRemove(category.id)}
                aria-label={`${category.name} を削除`}
              >
                <Icon name="trash" />
              </button>

              {confirmingRemove === category.id && (
                <div className="category-row__confirm">
                  <span>
                    {(categoryUsage[category.id] ?? 0) > 0
                      ? `${categoryUsage[category.id]} 件のタスクが未分類になります。`
                      : '削除しますか？'}
                  </span>
                  <button
                    type="button"
                    className="danger-button danger-button--small"
                    onClick={() => {
                      onRemoveCategory(category.id)
                      setConfirmingRemove(null)
                    }}
                  >
                    削除
                  </button>
                  <button type="button" className="ghost" onClick={() => setConfirmingRemove(null)}>
                    取消
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>

        <form className="category-add" onSubmit={handleAddCategory}>
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="カテゴリを追加"
            aria-label="新しいカテゴリ名"
          />
          <select
            value={newColor}
            onChange={(e) => setNewColor(e.target.value as CategoryColor)}
            aria-label="新しいカテゴリの色"
          >
            {CATEGORY_COLORS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <button type="submit" disabled={newCategory.trim() === ''}>
            追加
          </button>
        </form>
      </section>
      <section className="detail__section">
        <details className="settings__fold">
          <summary className="detail__label">見た目（{currentThemeName}・{appearanceLabel}）</summary>
        <ThemePicker
          theme={settings.theme}
          appearance={settings.appearance}
          resolved={resolvedAppearance}
          onChangeTheme={(theme) => onUpdateSettings({ theme })}
          onChangeAppearance={(appearance) => onUpdateSettings({ appearance })}
        />
        </details>
      </section>

      <section className="detail__section">
        <h3 className="detail__label">データ</h3>
        <DataPanel store={store} onImport={onImport} onExported={onExported} />

        <label className="field">
          <span className="field__label">古い完了タスクを自動で消す</span>
          <select
            value={settings.archiveAfterDays}
            onChange={(e) => {
              const days = Number(e.target.value)
              // 消える件数を先に見せて、そのうえで選ばせる。
              const willDelete = staleTodos({ ...store, settings: { ...settings, archiveAfterDays: days } }, new Date().toISOString())
              if (willDelete.length > 0) {
                const ok = window.confirm(
                  `いま ${willDelete.length} 件が対象になります。\n次にアプリを開いたときに消え、他の端末とサーバーからも消えます。\n続けますか？`,
                )
                if (!ok) return
              }
              onUpdateSettings({ archiveAfterDays: days })
            }}
          >
            <option value={0}>消さない</option>
            <option value={30}>完了から 30 日</option>
            <option value={90}>完了から 90 日</option>
            <option value={365}>完了から 1 年</option>
          </select>
        </label>
        <p className="detail__hint">
          既定は「消さない」です。完了したタスクは放っておくと溜まり続け、同期のたびに
          全件をやり取りすることになるので、気になったら選んでください。
          <strong>消えたことは他の端末とサーバーにも伝わり、取り消せません。</strong>
        </p>
      </section>
    </div>
  )
}