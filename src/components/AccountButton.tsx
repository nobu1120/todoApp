import type { SyncStatus } from '../hooks/useSync'
import { Icon } from './Icon'

type Props = {
  email: string | null
  status: SyncStatus
  onClick: () => void
}

/**
 * ヘッダーに常時出す。
 * 「今どのアカウントか」を、設定を開かなくても分かるようにするのが目的。
 */
export function AccountButton({ email, status, onClick }: Props) {
  if (email === null) {
    return (
      <button type="button" className="account-button" onClick={onClick}>
        <Icon name="user" />
        ログイン
      </button>
    )
  }

  // 表示は @ より前だけ。狭い画面でも読めて、どの口座かは判別できる。
  const name = email.split('@')[0]
  const initial = (name[0] ?? '?').toUpperCase()

  return (
    <button
      type="button"
      className="account-button account-button--signed-in"
      onClick={onClick}
      aria-label={`アカウント: ${email}（${status === 'error' ? '同期エラー' : status === 'syncing' ? '同期中' : '同期済み'}）`}
    >
      <span className="account-button__avatar" aria-hidden="true">
        {initial}
      </span>
      <span className="account-button__name">{name}</span>
      <span
        className={`account-button__dot account-button__dot--${status}`}
        aria-hidden="true"
      />
    </button>
  )
}
