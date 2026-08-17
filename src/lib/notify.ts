import type { Todo } from '../types'
import { formatDue } from './date'

/**
 * OS 通知は「ページを開いている間」しか出せない。
 * 閉じている間に鳴らすには push サーバーが要るため、このアプリの範囲外。
 * 閉じている間に来た期限は、次に開いたときの画面内リマインドで拾う。
 *
 * さらにモバイルでは経路が違う。Android Chrome は new Notification() が
 * 使えず（Illegal constructor で例外）、Service Worker の
 * showNotification() を使う必要がある。iOS はホーム画面に追加しないと
 * Notification API 自体が存在しない。
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

let registration: ServiceWorkerRegistration | null = null

/**
 * 通知用の Service Worker を用意する。
 * 登録できなくてもアプリは動くので、失敗は握って null を返す。
 */
export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (registration !== null) return registration
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
    return registration
  } catch {
    return null
  }
}

export async function showTodoNotification(todo: Todo, today: string): Promise<void> {
  if (permissionState() !== 'granted') return

  const due = todo.dueDate === null ? '' : formatDue(todo.dueDate, todo.dueTime, today)
  const title = `${todo.icon ? `${todo.icon} ` : ''}${todo.title}`
  const options: NotificationOptions = {
    body: due === '' ? '期限になりました' : `期限: ${due}`,
    // 同じタスクの通知が積み上がらないよう、id で置き換える。
    tag: `todo-${todo.id}`,
    icon: `${import.meta.env.BASE_URL}icon-192.png`,
  }

  // モバイルではこちらしか通らない。まず Service Worker 経由で試す。
  const reg = await ensureServiceWorker()
  if (reg !== null) {
    try {
      await reg.showNotification(title, options)
      return
    } catch {
      // 登録はできたが通知は出せなかった場合、下の経路にフォールバックする。
    }
  }

  try {
    new Notification(title, options)
  } catch {
    // デスクトップ以外ではここに来る。通知は諦め、アプリの動作は止めない。
  }
}
