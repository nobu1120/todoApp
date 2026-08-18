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
 *   そこで 2 段構えにする。
 *     1) 画面側が「いま読み込んだ資産の一覧」を message で渡してくる（cache-now）。
 *        初回訪問でも、その訪問のうちに資産が貯まる。
 *     2) 以後は取得したものを貯め直す（stale-while-revalidate）。
 *   これをしないと、初回訪問だけでは JS も CSS もキャッシュされず、
 *   「一度開いたのに圏外で真っ白」になる（実際そうなっていた）。
 */

const CACHE = 'todo-v2'

/*
 * 取り出すときは Vary を無視する。
 * 配信側が `Vary: Origin` を返すと、保存したときと取り出すときで
 * Origin ヘッダの有無が違うだけで一致しなくなり、キャッシュがあるのに
 * 「見つからない」になる（実測でこれに当たった）。
 */
const MATCH = { ignoreVary: true }

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

/**
 * 画面から「この資産を持っておいて」と渡される。
 * ハッシュ付きのファイル名は SW 側からは分からないので、読み込んだ側に教えてもらう。
 */
self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || data.type !== 'cache-now' || !Array.isArray(data.urls)) return
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // 1 つ失敗しても他を諦めない（addAll は全か無かなので使わない）。
      await Promise.all(data.urls.map((url) => cache.add(url).catch(() => undefined)))

      /*
       * 今の世代に属さないものを捨てる。
       * これをしないと、デプロイのたびにハッシュ付きの JS/CSS が積み上がり、
       * 一つも消えない。容量上限に当たった時点で cache.put が黙って失敗し
       * （失敗は握り潰している）、「新しい資産が貯まらない」状態へ静かに移る。
       */
      const keep = new Set(data.urls.map((url) => new URL(url, self.location.href).href))
      const start = new URL(self.registration.scope).href
      keep.add(start)
      const stale = (await cache.keys()).filter((req) => !keep.has(req.url))
      await Promise.all(stale.map((req) => cache.delete(req)))
    }),
  )
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
        caches
          .match(request, MATCH)
          .then((hit) => hit || caches.match('./', MATCH))
          .then(
            (hit) =>
              hit || new Response('オフラインです', { status: 503, statusText: 'Offline' }),
          ),
      ),
    )
    return
  }

  event.respondWith(
    caches.match(request, MATCH).then((hit) => {
      const fresh = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone()
            // 容量超過などで失敗しても、応答そのものは返す。
            caches.open(CACHE).then((cache) => cache.put(request, copy).catch(() => undefined))
          }
          return response
        })
        .catch(() => hit)
      // キャッシュも無くネットワークも死んでいるとき、undefined を返すと
      // 応答なしで真っ白になる。何が起きたか分かる形で返す。
      return (
        hit ||
        fresh.then(
          (r) => r || new Response('オフラインです', { status: 503, statusText: 'Offline' }),
        )
      )
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
