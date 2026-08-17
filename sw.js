/*
 * 通知を出すためだけの Service Worker。キャッシュは一切しない。
 *
 * Android Chrome では new Notification() が使えず
 * （Illegal constructor で例外になる）、
 * ServiceWorkerRegistration.showNotification() を使う必要がある。
 * iOS も、ホーム画面に追加した状態ではこちらの経路になる。
 */

self.addEventListener('install', () => {
  // 更新したらすぐ次の版に入れ替える。
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// 通知をタップしたら、開いているタブに戻す。無ければ新しく開く。
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) return client.focus()
        }
        if (self.clients.openWindow) return self.clients.openWindow('./')
        return undefined
      }),
  )
})
