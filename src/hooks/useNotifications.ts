import { useCallback, useEffect, useRef, useState } from 'react'
import type { Settings, Todo } from '../types'
import { nextNotifyAt, todosToNotify } from '../lib/todos'
import {
  ensureServiceWorker,
  permissionState,
  requestPermission,
  showTodoNotification,
} from '../lib/notify'
import type { PermissionState } from '../lib/notify'

/**
 * 次の期限が遠くても、いったんここで起き直す。
 *
 * setTimeout は端末がスリープしている間は進まず、時計を合わせ直されても
 * ずれる。長く寝かせるほど「起きたら 3 時間前の期限だった」が起きやすい。
 */
const MAX_SLEEP_MS = 10 * 60 * 1000

/**
 * 起こす時刻を少しだけ後ろに倒す。
 *
 * タイマーは数ミリ秒早く発火することがあり、その瞬間はまだ期限前なので
 * todosToNotify が空を返す。取りこぼしではなく即座に張り直すだけだが、
 * 無駄な往復を減らす。
 */
const OVERSHOOT_MS = 250

type Params = {
  todos: Todo[]
  settings: Settings
  today: string
  onNotified: (ids: string[]) => void
  /** サーバーから push が届く状態なら、画面側のタイマーは止める（二重通知を防ぐ）。 */
  paused?: boolean
}

export function useNotifications({ todos, settings, today, onNotified, paused = false }: Params) {
  const [permission, setPermission] = useState<PermissionState>(permissionState)

  const active = settings.notificationsEnabled && permission === 'granted' && !paused

  // タイマーを張り直さずに最新の値を読むための箱。
  // これらを依存配列に入れると、タスクを触るたびにタイマーが作り直される。
  const latest = useRef({ todos, settings, today, onNotified, active })
  useEffect(() => {
    latest.current = { todos, settings, today, onNotified, active }
  })

  const enable = useCallback(async () => {
    const next = await requestPermission()
    setPermission(next)
    if (next === 'granted') await ensureServiceWorker()
    return next
  }, [])

  const check = useCallback(() => {
    const current = latest.current
    if (!current.active) return
    const due = todosToNotify(current.todos, current.settings, new Date())
    if (due.length === 0) return
    for (const todo of due) void showTodoNotification(todo, current.today)
    // 通知済みとして記録し、同じタスクで二度鳴らないようにする。
    current.onNotified(due.map((t) => t.id))
  }, [])

  // 画面に戻ってきたときのチェック。
  // ここでは初回の check() を呼ばない。呼ぶと、下の効果と同じ commit で
  // 二重に走り、markNotified が反映される前に同じタスクを 2 回通知してしまう。
  // 初回ぶんは下の効果（todos を依存に持つのでマウント時にも走る）が担当する。
  useEffect(() => {
    if (!active) return

    void ensureServiceWorker()

    // 画面が消えている間はタイマーが止まる（スマホでは特に顕著）。
    // 戻ってきた瞬間に見直して、溜まっていた期限をその場で拾う。
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', check)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', check)
    }
  }, [active, check])

  /*
   * マウント時の初回チェックと、次の期限ちょうどに起こすタイマー。
   *
   * 一定間隔で見に行くのはやめた。30 秒ごとだと 9:00 の通知が 9:00:30 に
   * なりうるうえ、裏に回ったタブでは間引かれて 1 分以上空く。
   * 代わりに「次に通知すべき時刻」を出して、そこまで正確に寝かせる。
   * todos が変わるたびに張り直すので、期限をいじった直後も正しく追従する。
   */
  useEffect(() => {
    if (!active) return

    let timer: ReturnType<typeof setTimeout> | null = null

    const run = () => {
      check()
      const current = latest.current
      const at = nextNotifyAt(current.todos, current.settings, new Date())
      const wait =
        at === null
          ? MAX_SLEEP_MS
          : Math.min(Math.max(at.getTime() - Date.now() + OVERSHOOT_MS, 0), MAX_SLEEP_MS)
      timer = setTimeout(run, wait)
    }
    run()

    return () => {
      if (timer !== null) clearTimeout(timer)
    }
  }, [todos, settings.defaultNotifyTime, active, check])

  return { permission, enable }
}
