import { useState, type FormEvent } from 'react'
import type { SyncStatus } from '../hooks/useSync'
import { Icon } from './Icon'
import { ErrorNote } from './ErrorNote'

type Props = {
  email: string | null
  status: SyncStatus
  error: string | null
  lastSyncedAt: string | null
  pushReady: boolean
  onSignIn: (email: string) => Promise<void>
  onSignInWithLink: (pastedLink: string) => Promise<void>
  onSignOut: () => Promise<void>
  onSync: () => Promise<void>
}

const STATUS_LABEL: Record<SyncStatus, string> = {
  off: '同期していません',
  syncing: '同期中...',
  synced: '同期済み',
  error: '同期に失敗しました',
}

function formatSyncedAt(iso: string): string {
  const at = new Date(iso)
  const diff = Date.now() - at.getTime()
  if (diff < 60_000) return 'たった今'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分前`
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
}

export function AccountPanel({
  email,
  status,
  error,
  lastSyncedAt,
  pushReady,
  onSignIn,
  onSignInWithLink,
  onSignOut,
  onSync,
}: Props) {
  const [input, setInput] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const [pastedLink, setPastedLink] = useState('')
  const [pasting, setPasting] = useState(false)

  async function handleSignIn(event: FormEvent) {
    event.preventDefault()
    const address = input.trim()
    if (address === '') return
    setBusy(true)
    setLocalError(null)
    try {
      await onSignIn(address)
      setSentTo(address)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handlePastedLink(event: FormEvent) {
    event.preventDefault()
    if (pastedLink.trim() === '') return
    setPasting(true)
    setLocalError(null)
    try {
      await onSignInWithLink(pastedLink)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err))
    } finally {
      setPasting(false)
    }
  }

  // --- 未ログイン ---
  if (email === null) {
    return (
      <div className="account">
        <div className="account__hero">
          <span className="account__avatar account__avatar--empty" aria-hidden="true">
            <Icon name="user" />
          </span>
          <div>
            <p className="account__title">ログインしていません</p>
            <p className="account__sub">この端末の中だけで動いています</p>
          </div>
        </div>

        <p className="detail__hint">
          ログインすると、複数の端末で同じリストを見られます。
          閉じている間の通知もログインが前提です。
          ログインしなくても、今までどおりこの端末だけで使えます。
        </p>

        {sentTo !== null ? (
          <div className="account__sent">
            <p>
              <strong>{sentTo}</strong> にログイン用のリンクを送りました。
            </p>
            <p className="detail__hint">
              メールが届かないときは、迷惑メールを確認してください。
            </p>
            <button type="button" className="ghost" onClick={() => setSentTo(null)}>
              別のアドレスを使う
            </button>
          </div>
        ) : (
          <form className="account__form" onSubmit={handleSignIn}>
            <input
              type="email"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="メールアドレス"
              aria-label="メールアドレス"
              autoComplete="email"
            />
            <button type="submit" disabled={busy || input.trim() === ''}>
              {busy ? '送信中...' : 'ログイン用リンクを送る'}
            </button>
          </form>
        )}

        <ErrorNote error={localError} />

        <details className="account__fallback">
          <summary>リンクを開いても戻ってこないとき</summary>
          <p className="detail__hint">
            メール内のリンクを<strong>開かずに長押しでコピー</strong>して、ここに貼り付けてください。
            ページを移動せずに、そのままログインします。
          </p>
          <form className="account__form" onSubmit={handlePastedLink}>
            <input
              type="text"
              value={pastedLink}
              onChange={(e) => setPastedLink(e.target.value)}
              placeholder="メールからコピーしたリンクを貼り付け"
              aria-label="ログインリンク"
            />
            <button type="submit" disabled={pasting || pastedLink.trim() === ''}>
              {pasting ? '確認中...' : 'このリンクでログイン'}
            </button>
          </form>
          <p className="detail__hint">
            一度開いたリンクは使えません。その場合はもう一度リンクを送ってから、コピーしてください。
          </p>
        </details>
      </div>
    )
  }

  // --- ログイン済み ---
  const name = email.split('@')[0]
  return (
    <div className="account">
      <div className="account__hero">
        <span className="account__avatar" aria-hidden="true">
          {(name[0] ?? '?').toUpperCase()}
        </span>
        <div className="account__id">
          <p className="account__title">{email}</p>
          <p className="account__sub">
            {STATUS_LABEL[status]}
            {status === 'synced' && lastSyncedAt !== null && ` · ${formatSyncedAt(lastSyncedAt)}`}
          </p>
        </div>
      </div>

      {error !== null && <p className="detail__hint detail__hint--warn">{error}</p>}

      <dl className="account__facts">
        <div>
          <dt>端末間の同期</dt>
          <dd>有効</dd>
        </div>
        <div>
          <dt>閉じている間の通知</dt>
          <dd>
            {pushReady ? 'この端末で受け取る' : '未設定'}
            {!pushReady && <span className="detail__hint">設定 › 通知 から登録できます</span>}
          </dd>
        </div>
      </dl>

      <div className="account__actions">
        <button type="button" onClick={() => void onSync()} disabled={status === 'syncing'}>
          今すぐ同期
        </button>
        {confirmingSignOut ? (
          <>
            <button
              type="button"
              className="danger-button danger-button--small"
              onClick={() => {
                setConfirmingSignOut(false)
                void onSignOut()
              }}
            >
              ログアウトする
            </button>
            <button type="button" className="ghost" onClick={() => setConfirmingSignOut(false)}>
              取消
            </button>
          </>
        ) : (
          <button type="button" className="ghost" onClick={() => setConfirmingSignOut(true)}>
            ログアウト
          </button>
        )}
      </div>

      <p className="detail__hint">
        ログアウトすると、この端末の通知の宛先も解除します。
        端末に保存されているタスクは消えません。
      </p>
    </div>
  )
}
