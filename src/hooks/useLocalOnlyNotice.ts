import { useCallback, useEffect, useState } from 'react'

const KEY = 'todoApp.localOnlyNotice'
const SNOOZE_DAYS = 30
const NAG_AFTER_TODOS = 20

/**
 * 「データはこの端末の中だけ」の報せを、出すかどうか決める。
 *
 * 以前は未ログインなら常時出していた。閉じる手段が無く、一覧の上を
 * 117px 占め続けるので読み飛ばされるようになり、同じ見た目で出る
 * 同期の失敗まで一緒に無視される状態になっていた。
 *
 * 出すのは「失うものが大きくなったとき」だけにする。
 */
export function useLocalOnlyNotice(count: number) {
  const [snoozedUntil, setSnoozedUntil] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(KEY) ?? 0)
    } catch {
      return 0
    }
  })

  useEffect(() => {
    try {
      if (snoozedUntil > 0) localStorage.setItem(KEY, String(snoozedUntil))
    } catch {
      // 保存できなくても、この画面のあいだは黙っていられる。
    }
  }, [snoozedUntil])

  const dismiss = useCallback(() => {
    setSnoozedUntil(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000)
  }, [])

  // 失うものが増えてから言う。数件のうちは黙っている。
  const worthSaying = count >= NAG_AFTER_TODOS
  return { show: worthSaying && Date.now() >= snoozedUntil, dismiss }
}
