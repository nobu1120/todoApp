import { useCallback, useEffect, useState } from 'react'
import type { Settings, Todo } from '../types'
import { todosToNotify } from '../lib/todos'
import { permissionState, requestPermission, showTodoNotification } from '../lib/notify'
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

  const enable = useCallback(async () => {
    const next = await requestPermission()
    setPermission(next)
    return next
  }, [])

  useEffect(() => {
    if (!settings.notificationsEnabled || permission !== 'granted') return

    const check = () => {
      const due = todosToNotify(todos, settings, new Date())
      if (due.length === 0) return
      for (const todo of due) showTodoNotification(todo, today)
      // 通知済みとして記録し、同じタスクで二度鳴らないようにする。
      onNotified(due.map((t) => t.id))
    }

    check()
    const timer = setInterval(check, CHECK_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [todos, settings, today, permission, onNotified])

  return { permission, enable }
}
