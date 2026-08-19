import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel, Session } from '@supabase/supabase-js'
import type { TodoStore } from '../types'
import { VAPID_PUBLIC_KEY, getSupabase, hasStoredSession, localTimeZone } from '../lib/supabase'
import {
  mergeStore,
  toRemoteCategory,
  toRemoteSettings,
  toRemoteTodo,
  type RemoteCategory,
  type RemoteSettings,
  type RemoteTodo,
} from '../lib/sync'
import { existingPushEndpoint, subscribeToPush, unsubscribeFromPush } from '../lib/notify'
import { parseAuthLink } from '../lib/authLink'

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'error'

const EPOCH = '1970-01-01T00:00:00.000Z'
/** 連続した編集でサーバーを叩きすぎないよう、少し待ってからまとめて送る。 */
const PUSH_DEBOUNCE_MS = 700

export function useSync(store: TodoStore, replaceStore: (next: TodoStore) => void) {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<SyncStatus>('off')
  const [error, setError] = useState<string | null>(null)
  const [pushReady, setPushReady] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  // 送信済みの水位。ここより新しい行だけを送るので、毎回全件送らずに済む。
  const pushedUpTo = useRef(EPOCH)
  const storeRef = useRef(store)
  useEffect(() => {
    storeRef.current = store
  })

  /**
   * Supabase 本体はここで初めて読み込む。
   * 前にログインした痕跡が無ければ、読み込まずに待つ（ログインは任意の機能なので、
   * 使わない人に 220KB を配らない）。ログイン操作をした時点で読み込まれる。
   */
  const [needsAuth, setNeedsAuth] = useState(() => hasStoredSession())
  /*
   * 前にログインした痕跡があるのに、まだセッションを確かめられていない状態。
   * ここを「未ログイン」と同じ扱いにすると、読み込みに失敗しただけなのに
   * 「データはこの端末の中だけにあります」と誤って安心させてしまう。
   */
  const [authPending, setAuthPending] = useState(() => hasStoredSession())

  useEffect(() => {
    if (!needsAuth) return
    let unsubscribe: (() => void) | null = null
    let cancelled = false
    setAuthPending(true)

    void getSupabase()
      .then((supabase) => {
        if (cancelled) return
        void supabase.auth.getSession().then(({ data }) => {
          setSession(data.session)
          setAuthPending(false)
        })
        const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
        unsubscribe = () => data.subscription.unsubscribe()
      })
      .catch((err) => {
        if (cancelled) return
        setAuthPending(false)
        setStatus('error')
        setError(
          `ログイン状態を確かめられませんでした（${err instanceof Error ? err.message : String(err)}）。この端末の変更はまだ送られていません。`,
        )
      })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [needsAuth])

  const userId = session?.user.id ?? null

  /** サーバーと突き合わせて、両方を最新に揃える。 */
  const fullSync = useCallback(async () => {
    if (userId === null) return
    setStatus('syncing')
    setError(null)
    try {
      const supabase = await getSupabase()
      /*
       * 水位は「これ以降に触ったものは未送信」と言い切れる時刻でなければ
       * ならないので、問い合わせを投げる前に決める。取り込んだあとに決めると、
       * 往復している数百 ms のあいだの編集が push の対象から外れたまま
       * 水位だけ越えてしまい、その端末にしか存在しない状態で固定される。
       * 多少送り直しが増えるほうが、取りこぼすよりはるかに安全。
       */
      const now = new Date().toISOString()
      const [todos, categories, settings] = await Promise.all([
        supabase.from('todo_items').select('*').eq('user_id', userId),
        supabase.from('todo_categories').select('*').eq('user_id', userId),
        supabase.from('todo_settings').select('*').eq('user_id', userId).maybeSingle(),
      ])
      if (todos.error) throw todos.error
      if (categories.error) throw categories.error
      if (settings.error) throw settings.error

      const local = storeRef.current
      const result = mergeStore(local, {
        todos: (todos.data ?? []) as RemoteTodo[],
        categories: (categories.data ?? []) as RemoteCategory[],
        settings: (settings.data ?? null) as RemoteSettings | null,
      })

      /*
       * 送信は「1 つ失敗したら全部やめる」にしない。
       * 以前はカテゴリの送信で例外を投げていたため、そこで止まって
       * タスクも設定も一度もサーバーに届かなかった（それに気づけないまま
       * ログイン済みの表示だけが出ていた）。部分的にでも通しておき、
       * 失敗は最後にまとめて報せる。
       */
      const failures: string[] = []
      const step = async (label: string, run: () => PromiseLike<{ error: unknown }>) => {
        const { error: e } = await run()
        if (e) failures.push(`${label}: ${e instanceof Error ? e.message : String(e)}`)
      }

      if (result.pushTodos.length > 0) {
        await step('タスクの保存', () =>
          supabase.from('todo_items').upsert(result.pushTodos.map((t) => toRemoteTodo(t, userId))),
        )
      }
      if (result.pushCategories.length > 0) {
        await step('カテゴリの保存', () =>
          supabase
            .from('todo_categories')
            .upsert(result.pushCategories.map((c) => toRemoteCategory(c, userId))),
        )
      }
      if (result.pushDeletedTodoIds.length > 0) {
        await step('タスクの削除', () =>
          supabase
            .from('todo_items')
            .update({ deleted_at: now, updated_at: now })
            .in('id', result.pushDeletedTodoIds),
        )
      }
      if (result.pushDeletedCategoryIds.length > 0) {
        await step('カテゴリの削除', () =>
          supabase
            .from('todo_categories')
            .update({ deleted_at: now, updated_at: now })
            .in('id', result.pushDeletedCategoryIds),
        )
      }
      await step('設定の保存', () =>
        supabase.from('todo_settings').upsert(toRemoteSettings(
            result.store.settings,
            userId,
            localTimeZone(),
            result.store.memo,
            result.store.shopping,
          )),
      )

      if (failures.length > 0) throw new Error(failures.join(' / '))

      // 取り込んだぶんを送り返さないよう、先に水位を上げてから反映する。
      pushedUpTo.current = now
      replaceStore(result.store)
      setLastSyncedAt(new Date().toISOString())
      setStatus('synced')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [userId, replaceStore])

  /** 前回より後に触ったぶんだけを送る。 */
  const pushChanges = useCallback(async () => {
    if (userId === null) return
    const local = storeRef.current
    const since = pushedUpTo.current
    const todos = local.todos.filter((t) => t.updatedAt > since)
    const graves = local.tombstones.filter((t) => t.deletedAt > since)
    // カテゴリも送る。送らないと、改名や色の変更が次の全同期で巻き戻る。
    const categories = local.categories.filter((c) => c.updatedAt > since)
    // 設定もここで送る。送らないと、次の全同期でサーバーの値に巻き戻ってしまう。
    // メモは設定と同じ行に入るので、どちらかが変わっていれば送る。
    const settingsChanged =
      local.settings.updatedAt > since ||
      local.memo.updatedAt > since ||
      local.shopping.updatedAt > since
    if (todos.length === 0 && graves.length === 0 && categories.length === 0 && !settingsChanged)
      return

    setStatus('syncing')
    try {
      // fullSync と同じ理由で、通信を始める前に水位を決める。
      const now = new Date().toISOString()
      const supabase = await getSupabase()

      /*
       * ここも「失敗しても止めない、ただし必ず報せる」。
       * 以前は削除の送信だけ戻り値を見ておらず、失敗しても水位（pushedUpTo）が
       * 進むので二度と再送されず、しかも画面は「同期済み」のままだった。
       */
      const failures: string[] = []
      const step = async (label: string, run: () => PromiseLike<{ error: unknown }>) => {
        const { error: e } = await run()
        if (e) failures.push(`${label}: ${e instanceof Error ? e.message : String(e)}`)
      }

      if (todos.length > 0) {
        await step('タスクの保存', () =>
          supabase.from('todo_items').upsert(todos.map((t) => toRemoteTodo(t, userId))),
        )
      }
      if (categories.length > 0) {
        await step('カテゴリの保存', () =>
          supabase.from('todo_categories').upsert(categories.map((c) => toRemoteCategory(c, userId))),
        )
      }
      const deadTodos = graves.filter((g) => g.kind === 'todo').map((g) => g.id)
      const deadCategories = graves.filter((g) => g.kind === 'category').map((g) => g.id)
      if (deadTodos.length > 0) {
        await step('タスクの削除', () =>
          supabase
            .from('todo_items')
            .update({ deleted_at: now, updated_at: now })
            .in('id', deadTodos),
        )
      }
      if (deadCategories.length > 0) {
        await step('カテゴリの削除', () =>
          supabase
            .from('todo_categories')
            .update({ deleted_at: now, updated_at: now })
            .in('id', deadCategories),
        )
      }
      if (settingsChanged) {
        await step('設定とメモの保存', () =>
          supabase.from('todo_settings').upsert(toRemoteSettings(local.settings, userId, localTimeZone(), local.memo, local.shopping)),
        )
      }

      // 届かなかったぶんを次回も送れるよう、失敗したときは水位を進めない。
      if (failures.length > 0) throw new Error(failures.join(' / '))

      pushedUpTo.current = now
      setLastSyncedAt(new Date().toISOString())
      setStatus('synced')
      setError(null)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [userId])

  // ログインしたら全体を突き合わせる。ログアウトしたら水位を戻す。
  useEffect(() => {
    if (userId === null) {
      setStatus('off')
      setLastSyncedAt(null)
      pushedUpTo.current = EPOCH
      return
    }
    void fullSync()
  }, [userId, fullSync])

  // 触った内容を少し待ってから送る。
  useEffect(() => {
    if (userId === null) return
    const timer = setTimeout(() => void pushChanges(), PUSH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [store, userId, pushChanges])

  // 他の端末の変更を受け取る。細かく差分を当てず、まとめて突き合わせ直す。
  useEffect(() => {
    if (userId === null) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const schedule = () => {
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(() => void fullSync(), 400)
    }

    let channel: RealtimeChannel | null = null
    let cancelled = false

    void getSupabase().then((supabase) => {
      if (cancelled) return
      channel = supabase
        .channel(`todo-sync-${userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'todo_items', filter: `user_id=eq.${userId}` },
          schedule,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'todo_categories', filter: `user_id=eq.${userId}` },
          schedule,
        )
        .subscribe()
    })

    return () => {
      cancelled = true
      if (timer !== null) clearTimeout(timer)
      if (channel !== null) void getSupabase().then((supabase) => supabase.removeChannel(channel!))
    }
  }, [userId, fullSync])

  // 復帰時にも取り込み直す。スリープ中は realtime が切れていることがある。
  useEffect(() => {
    if (userId === null) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fullSync()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [userId, fullSync])

  // --- 操作 ---

  const signIn = useCallback(async (email: string) => {
    // ログイン操作をした時点で本体が要る。以降は購読も始める。
    setNeedsAuth(true)
    const supabase = await getSupabase()
    const { error: e } = await supabase.auth.signInWithOtp({
      email,
      // 許可リストと突き合わせやすいよう、問い合わせ文字列を含まない固定の URL を渡す。
      options: { emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
    })
    if (e) throw e
  }, [])

  /**
   * メールのリンクを貼ってログインする。
   * 戻り先が許可リストに無いとリダイレクトが別アプリに向いてしまうため、
   * リダイレクトを介さずトークンだけでセッションを作る経路を用意しておく。
   */
  const signInWithLink = useCallback(async (pasted: string) => {
    const parsed = parseAuthLink(pasted)
    if (parsed === null) {
      throw new Error('リンクからログイン用のトークンを読み取れませんでした。メール内のリンクをそのまま貼り付けてください。')
    }
    setNeedsAuth(true)
    const supabase = await getSupabase()
    const { error: e } = await supabase.auth.verifyOtp({
      token_hash: parsed.tokenHash,
      type: parsed.type,
    })
    if (e) throw e
  }, [])

  const signOut = useCallback(async () => {
    const supabase = await getSupabase()
    const endpoint = await unsubscribeFromPush()
    if (endpoint !== null) {
      await supabase.from('todo_push_subscriptions').delete().eq('endpoint', endpoint)
    }
    await supabase.auth.signOut()
    setPushReady(false)
    setLastSyncedAt(null)
  }, [])

  /*
   * 起動時に「この端末はもう登録済みか」を思い出す。
   * 覚えていないと、再読み込みのたびに pushReady が false に戻り、
   * 画面内タイマーによる通知とサーバーからの push が二重に鳴る
   * （設定画面も「まだ登録されていません」と嘘をつく）。
   */
  useEffect(() => {
    if (userId === null) {
      setPushReady(false)
      return
    }
    let cancelled = false
    void (async () => {
      const endpoint = await existingPushEndpoint()
      if (cancelled || endpoint === null) return
      const supabase = await getSupabase()
      const { data } = await supabase
        .from('todo_push_subscriptions')
        .select('endpoint')
        .eq('user_id', userId)
        .eq('endpoint', endpoint)
        .maybeSingle()
      if (!cancelled && data !== null) setPushReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  /** この端末を push の宛先として登録する。ログイン済みでないと意味がない。 */
  const registerPush = useCallback(async () => {
    if (userId === null) return false
    const keys = await subscribeToPush(VAPID_PUBLIC_KEY)
    if (keys === null) return false
    const supabase = await getSupabase()
    const { error: e } = await supabase.from('todo_push_subscriptions').upsert({
      endpoint: keys.endpoint,
      user_id: userId,
      p256dh: keys.p256dh,
      auth: keys.auth,
    })
    if (e) {
      setError(e.message)
      return false
    }
    setPushReady(true)
    return true
  }, [userId])

  return {
    session,
    /** ログイン状態をまだ確かめられていない。未ログインと区別する。 */
    authPending,
    email: session?.user.email ?? null,
    status,
    error,
    pushReady,
    lastSyncedAt,
    signIn,
    signInWithLink,
    signOut,
    registerPush,
    fullSync,
  }
}
