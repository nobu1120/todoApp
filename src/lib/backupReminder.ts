/**
 * 「控えを書き出しませんか」と言うべきかどうかの判断。
 *
 * このアプリの唯一の弱点は、作者が 1 人であることではなく、
 * 止めたときにデータごと消えることにある。書き出し機能はすでにあるので、
 * 足りないのは「定期的に実行する習慣」だけ。
 *
 * ただし出しすぎると読み飛ばされ、本当に見てほしい同期の失敗まで
 * 一緒に無視されるようになる（実際それで「この端末の中だけ」の警告を
 * 常設からやめた）。条件は厳しめにする。
 */

/** 前回の書き出しから、これだけ経ったら言う。 */
export const BACKUP_INTERVAL_DAYS = 60
/** 一度も書き出していない場合、使い始めてからこれだけ経ったら言う。 */
export const GRACE_DAYS = 14
/** 「あとで」を押されたら、これだけ黙る。 */
export const SNOOZE_DAYS = 30
/** これ未満の件数では言わない。失うものが小さいうちは黙っている。 */
export const MIN_TODOS = 5

const DAY = 24 * 60 * 60 * 1000

export type BackupState = {
  /** 最後に書き出した時刻（ISO）。一度も書き出していなければ null。 */
  lastBackupAt: string | null
  /** 使い始めた時刻（ISO）。 */
  firstRunAt: string
  /** 「あとで」を押した結果、この時刻までは黙る（ISO）。 */
  snoozedUntil: string | null
}

export type BackupPrompt = {
  show: boolean
  /** 何日ぶん放置しているか。文面に出す。 */
  days: number
  /** 一度も書き出していないか。 */
  never: boolean
}

export function backupPrompt(
  state: BackupState,
  todoCount: number,
  now: string = new Date().toISOString(),
): BackupPrompt {
  const at = Date.parse(now)
  const since = (iso: string) => Math.floor((at - Date.parse(iso)) / DAY)

  const never = state.lastBackupAt === null
  const days = never ? since(state.firstRunAt) : since(state.lastBackupAt as string)
  const quiet = { show: false, days, never }

  if (todoCount < MIN_TODOS) return quiet
  if (state.snoozedUntil !== null && at < Date.parse(state.snoozedUntil)) return quiet

  // 時計が巻き戻っている（端末の時刻設定など）ときは黙る。
  if (days < 0) return quiet

  return { show: days >= (never ? GRACE_DAYS : BACKUP_INTERVAL_DAYS), days, never }
}

/** 「あとで」を押されたときの、次に言ってよくなる時刻。 */
export function snoozeUntil(now: string = new Date().toISOString()): string {
  return new Date(Date.parse(now) + SNOOZE_DAYS * DAY).toISOString()
}
