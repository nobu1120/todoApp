import type { Todo } from '../types'
import { formatDue } from './date'

/**
 * OS 通知は「ページを開いている間」しか出せない。
 * 閉じている間に鳴らすには push サーバーが要るため、このアプリの範囲外。
 * 閉じている間に来た期限は、次に開いたときの画面内リマインドで拾う。
 */
export type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied'

export function permissionState(): PermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission as Exclude<PermissionState, 'unsupported'>
}

export async function requestPermission(): Promise<PermissionState> {
  if (permissionState() === 'unsupported') return 'unsupported'
  try {
    return (await Notification.requestPermission()) as PermissionState
  } catch {
    // Safari の古い実装などで reject されることがある。
    return permissionState()
  }
}

export function showTodoNotification(todo: Todo, today: string): void {
  if (permissionState() !== 'granted') return
  const due = todo.dueDate === null ? '' : formatDue(todo.dueDate, todo.dueTime, today)
  try {
    new Notification(`${todo.icon ? `${todo.icon} ` : ''}${todo.title}`, {
      body: due === '' ? '期限になりました' : `期限: ${due}`,
      // 同じタスクの通知が積み上がらないよう、id で置き換える。
      tag: `todo-${todo.id}`,
    })
  } catch {
    // 通知の生成に失敗しても、アプリの動作は止めない。
  }
}
