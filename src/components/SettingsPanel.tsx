import { useState, type FormEvent } from 'react'
import type { Category, CategoryColor, Settings } from '../types'
import type { PermissionState } from '../lib/notify'
import { CATEGORY_COLORS } from '../lib/categories'
import { Icon } from './Icon'

type Props = {
  settings: Settings
  permission: PermissionState
  categories: Category[]
  categoryUsage: Record<string, number>
  onUpdateSettings: (patch: Partial<Settings>) => void
  onEnableNotifications: () => Promise<PermissionState>
  onAddCategory: (name: string, color: CategoryColor) => void
  onUpdateCategory: (id: string, patch: Partial<Omit<Category, 'id'>>) => void
  onRemoveCategory: (id: string) => void
}

export function SettingsPanel({
  settings,
  permission,
  categories,
  categoryUsage,
  onUpdateSettings,
  onEnableNotifications,
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
  }

  function handleAddCategory(event: FormEvent) {
    event.preventDefault()
    if (newCategory.trim() === '') return
    onAddCategory(newCategory, newColor)
    setNewCategory('')
  }

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

            <p className="detail__hint">
              通知はこのページを開いている間だけ鳴ります。閉じている間に来た期限は、次に開いたときに
              画面上部のリマインドで表示します。
            </p>

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
    </div>
  )
}
