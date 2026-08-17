import { useCallback, useEffect, useRef, useState } from 'react'
import type { Settings, Todo } from '../types'
import { todosToNotify } from '../lib/todos'
import {
  ensureServiceWorker,
  permissionState,
  requestPermission,
  showTodoNotification,
} from '../lib/notify'
import type { PermissionState } from '../lib/notify'

/** 期限が来ていないか見に行く間隔。分単位の精度で十分なので 30 秒。 */
const CHECK_INTERVAL_MS = 30_000

type Params = {
  todos: Todo[]
  settings: Settings
  today: string
  onNotified: (ids: string[]) => void
}

export function useNotifications({ todos, settings, today, onNotified }: Params) {
  const [permission, setPermission] = useState<PermissionState>(permissionState)

  const active = settings.notificationsEnabled && permission === 'granted'

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

  // 定期チェックと、画面に戻ってきたときのチェック。
  // ここでは初回の check() を呼ばない。呼ぶと、下の効果と同じ commit で
  // 二重に走り、markNotified が反映される前に同じタスクを 2 回通知してしまう。
  // 初回ぶんは下の効果（todos を依存に持つのでマウント時にも走る）が担当する。
  useEffect(() => {
    if (!active) return

    void ensureServiceWorker()
    const timer = setInterval(check, CHECK_INTERVAL_MS)

    // 画面が消えている間はタイマーが止まる（スマホでは特に顕著）。
    // 戻ってきた瞬間に見直して、溜まっていた期限をその場で拾う。
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', check)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', check)
    }
  }, [active, check])

  // マウント時の初回チェックと、タスクが変わったときの見直しを兼ねる。
  // 期限を過去の時刻に変えたときに最大 30 秒待たされないようにするためで、
  // ここではタイマーを張り直さない。
  useEffect(() => {
    if (!active) return
    check()
  }, [todos, active, check])

  return { permission, enable }
}
