/*
 * 通知とオフラインのための Service Worker。
 *
 * 通知:
 *   Android Chrome では new Notification() が使えず
 *   （Illegal constructor で例外になる）、
 *   ServiceWorkerRegistration.showNotification() を使う必要がある。
 *   iOS も、ホーム画面に追加した状態ではこちらの経路になる。
 *
 * オフライン:
 *   ビルド成果物のファイル名はハッシュ付きで、ここからは分からない。
 *   そこで「一度読んだものを貯める」方式にする（stale-while-revalidate）。
 *   一度でも開いていれば、圏外・機内モードでもそのまま起動できる。
 *   データは元から端末内にあるので、これだけで通常どおり使える。
 */

const CACHE = 'todo-v1'

self.addEventListener('install', (event) => {
  // 起点だけは先に取っておく。以降は開いたものが順に貯まる。
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(['./', './manifest.webmanifest']))
      .catch(() => undefined),
  )
  // 更新したらすぐ次の版に入れ替える。
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

/**
 * 取得の方針。
 * - 画面遷移（navigate）: まずネットワーク。落ちたらキャッシュの起点を返す。
 * - 同じオリジンの GET: キャッシュを即返しつつ、裏で取り直して次に備える。
 * - それ以外（Supabase への通信など）: 素通し。キャッシュしない。
 */
self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((hit) => hit || caches.match('./')).then((hit) => hit || fetch(request)),
      ),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      const fresh = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => hit)
      return hit || fresh
    }),
  )
})

// サーバーから届いた通知。アプリを閉じていても、ここが起きて通知を出す。
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }

  const title = payload.title || 'Todo'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '期限になりました',
      // 同じタスクの通知が積み上がらないよう、id で置き換える。
      tag: payload.id ? `todo-${payload.id}` : 'todo',
      icon: './icon-192.png',
      badge: './icon-192.png',
      data: { id: payload.id || null },
      // 通知から直接片付けられるようにする。開き直す手間を省く。
      actions: payload.id ? [{ action: 'done', title: '完了' }] : [],
    }),
  )
})

// 通知をタップしたら、開いているタブに戻す。無ければ新しく開く。
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const id = (event.notification.data && event.notification.data.id) || null
  const done = event.action === 'done' && id !== null

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          // 開いているタブがあれば、そこへ「完了にして」と伝える。
          if (done) client.postMessage({ type: 'todo:done', id })
          if ('focus' in client) return client.focus()
        }
        if (self.clients.openWindow) {
          // 開いていないときは、URL に載せて起動時に処理させる。
          return self.clients.openWindow(done ? `./?done=${encodeURIComponent(id)}` : './')
        }
        return undefined
      }),
  )
})
