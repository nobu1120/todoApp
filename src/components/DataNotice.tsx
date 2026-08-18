import { Icon } from './Icon'

type Props = {
  /** 同期の失敗内容。null なら失敗していない。 */
  syncError: string | null
  signedIn: boolean
  /** ログイン状態をまだ確かめられていない。未ログインと同じ扱いにしない。 */
  authPending: boolean
  /** 端末にあるタスクの件数。0 件なら何も出さない。 */
  count: number
  onOpenAccount: () => void
  onOpenSettings: () => void
}

/**
 * データが危ない状態を、開かなくても分かる場所で報せる。
 *
 * ここを作った理由:
 *   同期の失敗は「アカウント画面を開けば見える」状態だったため、
 *   書き込みが全部エラーになっていることに長く気づけず、
 *   ブラウザのキャッシュ削除でタスクが失われた。
 *   失敗と「この端末にしかない」ことは、どちらも一覧の上に出す。
 */
export function DataNotice({
  syncError,
  signedIn,
  authPending,
  count,
  onOpenAccount,
  onOpenSettings,
}: Props) {
  if (syncError !== null) {
    return (
      <div className="notice notice--warn" role="alert">
        <span className="notice__icon" aria-hidden="true">
          <Icon name="alert" />
        </span>
        <div className="notice__body">
          <strong>同期できていません。</strong>
          この端末の変更はまだサーバーに届いていません。
          <span className="notice__detail">{syncError}</span>
        </div>
        <button type="button" onClick={onOpenAccount}>
          確認
        </button>
      </div>
    )
  }

  // 確かめている最中は、どちらとも言わない。
  if (authPending) return null

  // ログインしていないと、データはこの端末の中だけにある。
  // ブラウザのキャッシュ（サイトデータ）を消すと一緒に消える。
  if (!signedIn && count > 0) {
    return (
      <div className="notice" role="status">
        <span className="notice__icon" aria-hidden="true">
          <Icon name="alert" />
        </span>
        <div className="notice__body">
          データはこの端末の中だけにあります。
          <span className="notice__detail">
            ブラウザの閲覧データを消すと、一緒に消えます。
          </span>
        </div>
        <button type="button" onClick={onOpenAccount}>
          ログイン
        </button>
        <button type="button" className="ghost" onClick={onOpenSettings}>
          書き出す
        </button>
      </div>
    )
  }

  return null
}
