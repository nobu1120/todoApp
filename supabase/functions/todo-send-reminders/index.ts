// 期限が来たタスクを Web Push で送る。pg_cron から毎分呼ばれる。
//
// verify_jwt を切っているのは、呼び出し元が cron（JWT を持たない）だから。
// 代わりに x-cron-secret ヘッダを DB の値と突き合わせて入口を守る。
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

type Reminder = {
  item_id: string
  user_id: string
  title: string
  icon: string
  due_date: string
  due_time: string
  due_at: string
}

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

async function loadConfig(): Promise<Record<string, string>> {
  const { data, error } = await admin.from('todo_config').select('key, value')
  if (error) throw error
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
}

/** 'HH:MM:SS' を 'HH:MM' に詰める。秒まで出すと通知が野暮ったい。 */
const shortTime = (t: string) => (t ?? '').slice(0, 5)

/*
 * 通知を押さえておいてもらう上限（秒）。
 *
 * 既定のままだと web-push は 4 週間預ける。端末が圏外だっただけで、
 * 何日も経ってから「期限になりました」が鳴っていた。
 * DB 側が拾う窓（期限から 24 時間）と同じところで切って、
 * 窓を出たものは配信させずに捨てる。
 */
const WINDOW_MS = 24 * 60 * 60 * 1000
const ttlFor = (dueAt: string) => {
  const left = Date.parse(dueAt) + WINDOW_MS - Date.now()
  return Number.isNaN(left) ? 60 : Math.max(60, Math.floor(left / 1000))
}

Deno.serve(async (req: Request) => {
  try {
    const config = await loadConfig()

    const given = req.headers.get('x-cron-secret') ?? ''
    const expected = config.cron_secret ?? ''
    // 長さが違う時点で不一致だが、比較自体は固定長で行う。
    if (expected === '' || given !== expected) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    webpush.setVapidDetails(
      config.vapid_subject,
      config.vapid_public_key,
      config.vapid_private_key,
    )

    const { data: due, error: dueError } = await admin.rpc('todo_due_reminders')
    if (dueError) throw dueError
    const reminders = (due ?? []) as Reminder[]

    if (reminders.length === 0) {
      return Response.json({ sent: 0, notified: 0 })
    }

    const userIds = [...new Set(reminders.map((r) => r.user_id))]
    const { data: subs, error: subError } = await admin
      .from('todo_push_subscriptions')
      .select('endpoint, user_id, p256dh, auth')
      .in('user_id', userIds)
    if (subError) throw subError

    const byUser = new Map<string, typeof subs>()
    for (const s of subs ?? []) {
      const list = byUser.get(s.user_id) ?? []
      list.push(s)
      byUser.set(s.user_id, list)
    }

    let sent = 0
    const staleEndpoints: string[] = []
    // 主キーは (user_id, id) なので、id だけで更新すると
    // 同じ id を持つ別の人の行まで通知済みにしてしまう。
    const notified = new Map<string, string[]>()

    for (const reminder of reminders) {
      const targets = byUser.get(reminder.user_id) ?? []
      // 送り先が 1 つも無いなら通知済みにしない。端末を登録し直したときに拾い直せる。
      if (targets.length === 0) continue

      const dueLabel = `${reminder.due_date} ${shortTime(reminder.due_time)}`
      const payload = JSON.stringify({
        id: reminder.item_id,
        title: `${reminder.icon ? `${reminder.icon} ` : ''}${reminder.title}`,
        body: `期限: ${dueLabel}`,
        // 遅れて届いたときに、Service Worker 側で言い方を変えるために渡す。
        due: reminder.due_at,
        dueLabel,
      })
      const ttl = ttlFor(reminder.due_at)

      let deliveredToAny = false
      for (const target of targets) {
        try {
          await webpush.sendNotification(
            {
              endpoint: target.endpoint,
              keys: { p256dh: target.p256dh, auth: target.auth },
            },
            payload,
            // urgency を上げないと、端末が省電力に入っている間はまとめて
            // 後回しにされる。期限の通知は遅れたら意味が薄い。
            { TTL: ttl, urgency: 'high' },
          )
          sent++
          deliveredToAny = true
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode
          // 404 / 410 は購読が失効した印。掃除して次から送らない。
          if (status === 404 || status === 410) staleEndpoints.push(target.endpoint)
        }
      }

      if (deliveredToAny) {
        const list = notified.get(reminder.user_id) ?? []
        list.push(reminder.item_id)
        notified.set(reminder.user_id, list)
      }
    }

    const stamp = new Date().toISOString()
    let notifiedCount = 0
    for (const [uid, ids] of notified) {
      await admin
        .from('todo_items')
        .update({ notified_at: stamp })
        .eq('user_id', uid)
        .in('id', ids)
      notifiedCount += ids.length
    }

    if (staleEndpoints.length > 0) {
      await admin.from('todo_push_subscriptions').delete().in('endpoint', staleEndpoints)
    }

    return Response.json({
      sent,
      notified: notifiedCount,
      cleaned: staleEndpoints.length,
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
