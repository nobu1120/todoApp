import { useState, type FormEvent } from 'react'
import type { SyncStatus } from '../hooks/useSync'

type Props = {
  email: string | null
  status: SyncStatus
  error: string | null
  onSignIn: (email: string) => Promise<void>
  onSignOut: () => Promise<void>
  onSync: () => Promise<void>
}

const STATUS_LABEL: Record<SyncStatus, string> = {
  off: '同期していません',
  syncing: '同期中...',
  synced: '同期済み',
  error: '同期に失敗しました',
}

export function AccountPanel({ email, status, error, onSignIn, onSignOut, onSync }: Props) {
  const [input, setInput] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  async function handleSignIn(event: FormEvent) {
    event.preventDefault()
    if (input.trim() === '') return
    setBusy(true)
    setLocalError(null)
    try {
      await onSignIn(input.trim())
      setSent(true)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (email === null) {
    return (
      <section className="detail__section">
        <h3 className="detail__label">アカウント</h3>
        <p className="detail__hint">
          ログインすると、複数の端末で同じリストを見られます。
          閉じている間の通知もログインが前提です。
          ログインしなくても、この端末の中だけで今までどおり使えます。
        </p>

        {sent ? (
          <p className="detail__hint detail__hint--warn">
            {input} にログイン用のリンクを送りました。メールのリンクを開いてください。
          </p>
        ) : (
          <form className="category-add" onSubmit={handleSignIn}>
            <input
              type="email"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="メールアドレス"
              aria-label="メールアドレス"
              autoComplete="email"
            />
            <button type="submit" disabled={busy || input.trim() === ''}>
              {busy ? '送信中' : 'リンクを送る'}
            </button>
          </form>
        )}

        {localError !== null && <p className="detail__hint detail__hint--warn">{localError}</p>}
      </section>
    )
  }

  return (
    <section className="detail__section">
      <h3 className="detail__label">アカウント</h3>
      <p className="detail__hint">
        <strong>{email}</strong> でログイン中 — {STATUS_LABEL[status]}
      </p>
      {error !== null && <p className="detail__hint detail__hint--warn">{error}</p>}
      <div className="detail__due">
        <button type="button" onClick={() => void onSync()} disabled={status === 'syncing'}>
          今すぐ同期
        </button>
        <button type="button" className="ghost" onClick={() => void onSignOut()}>
          ログアウト
        </button>
      </div>
      <p className="detail__hint">
        ログアウトすると、この端末の通知の宛先も解除します。
        端末に保存されているタスクは消えません。
      </p>
    </section>
  )
}
