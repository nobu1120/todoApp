import { Icon } from './Icon'
import { friendly } from '../lib/errors'

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
  /** 「あとで」を押したときに呼ぶ。しばらく出さなくする。 */
  onDismiss: () => void
  /** いま「この端末の中だけ」の報せを出してよいか。 */
  showLocalOnly: boolean
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
  onDismiss,
  showLocalOnly,
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
          <span className="notice__detail">{friendly(syncError).message}</span>
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
  /*
   * 常設をやめた。閉じられない警告が毎回 117px を占め続けると
   * 読まれなくなり、本当に見てほしい同期の失敗（同じ部品）まで
   * 一緒に無視されるようになる。
   */
  if (!signedIn && count > 0 && showLocalOnly) {
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
        <button type="button" onClick={onOpenSettings}>
          控えを書き出す
        </button>
        <button type="button" className="ghost" onClick={onDismiss}>
          あとで
        </button>
      </div>
    )
  }

  return null
}
