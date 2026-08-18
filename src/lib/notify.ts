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
 * Service Worker を用意する。通知とオフラインの両方がこれに乗る。
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

/**
 * いま読み込んだ資産を Service Worker に伝えて、その場で貯めてもらう。
 *
 * ビルド成果物のファイル名はハッシュ付きで SW 側からは分からない。
 * これをしないと初回訪問では何も貯まらず、「一度開いたのに圏外で真っ白」になる。
 */
export async function cacheCurrentAssets(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.ready
    const worker = reg.active
    if (worker === null) return

    const urls = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .filter((url) => url.startsWith(location.origin))

    worker.postMessage({ type: 'cache-now', urls: [location.href, ...urls] })
  } catch {
    // 貯められなくてもアプリは動く。
  }
}

/**
 * base64url の VAPID 公開鍵を、PushManager が要求する形に直す。
 * ArrayBuffer を明示して確保する。Uint8Array の型は SharedArrayBuffer も
 * 取りうるため、そのままでは applicationServerKey に渡せない。
 */
function urlBase64ToBytes(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const buffer = new ArrayBuffer(raw.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i)
  return buffer
}

export type PushKeys = { endpoint: string; p256dh: string; auth: string }

function toKeys(subscription: PushSubscription): PushKeys | null {
  const json = subscription.toJSON()
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (json.endpoint === undefined || p256dh === undefined || auth === undefined) return null
  return { endpoint: json.endpoint, p256dh, auth }
}

/**
 * この端末を push の宛先として登録する。
 * 閉じている間に鳴らすにはこれが要る（開いている間だけなら不要）。
 */
export async function subscribeToPush(vapidPublicKey: string): Promise<PushKeys | null> {
  if (permissionState() !== 'granted') return null
  const reg = await ensureServiceWorker()
  if (reg === null) return null

  try {
    const existing = await reg.pushManager.getSubscription()
    if (existing !== null) return toKeys(existing)

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToBytes(vapidPublicKey),
    })
    return toKeys(subscription)
  } catch {
    // push に対応していない環境（iOS のブラウザタブなど）ではここに来る。
    return null
  }
}

export async function unsubscribeFromPush(): Promise<string | null> {
  const reg = await ensureServiceWorker()
  if (reg === null) return null
  try {
    const subscription = await reg.pushManager.getSubscription()
    if (subscription === null) return null
    const endpoint = subscription.endpoint
    await subscription.unsubscribe()
    return endpoint
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
    data: { id: todo.id },
  }

  // モバイルではこちらしか通らない。まず Service Worker 経由で試す。
  const reg = await ensureServiceWorker()
  if (reg !== null) {
    try {
      // 通知そのものから片付けられるようにする。actions は Service Worker 経由の
      // 通知にしか付けられず、TS の NotificationOptions にも載っていない。
      await reg.showNotification(title, {
        ...options,
        actions: [{ action: 'done', title: '完了' }],
      } as NotificationOptions & { actions: { action: string; title: string }[] })
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

/**
 * すでにこの端末が push を購読しているか。
 * 新しく許可を求めたり購読を作ったりはしない（起動時に呼ぶため）。
 */
export async function existingPushEndpoint(): Promise<string | null> {
  if (permissionState() !== 'granted') return null
  try {
    if (!('serviceWorker' in navigator)) return null
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    return existing?.endpoint ?? null
  } catch {
    return null
  }
}
