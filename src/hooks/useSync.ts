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
import { subscribeToPush, unsubscribeFromPush } from '../lib/notify'
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

  useEffect(() => {
    if (!needsAuth) return
    let unsubscribe: (() => void) | null = null
    let cancelled = false

    void getSupabase().then((supabase) => {
      if (cancelled) return
      void supabase.auth.getSession().then(({ data }) => setSession(data.session))
      const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
      unsubscribe = () => data.subscription.unsubscribe()
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

      const now = new Date().toISOString()

      if (result.pushCategories.length > 0) {
        const { error: e } = await supabase
          .from('todo_categories')
          .upsert(result.pushCategories.map((c) => toRemoteCategory(c, userId, now)))
        if (e) throw e
      }
      if (result.pushTodos.length > 0) {
        const { error: e } = await supabase
          .from('todo_items')
          .upsert(result.pushTodos.map((t) => toRemoteTodo(t, userId)))
        if (e) throw e
      }
      if (result.pushDeletedTodoIds.length > 0) {
        const { error: e } = await supabase
          .from('todo_items')
          .update({ deleted_at: now, updated_at: now })
          .in('id', result.pushDeletedTodoIds)
        if (e) throw e
      }
      if (result.pushDeletedCategoryIds.length > 0) {
        const { error: e } = await supabase
          .from('todo_categories')
          .update({ deleted_at: now, updated_at: now })
          .in('id', result.pushDeletedCategoryIds)
        if (e) throw e
      }

      const { error: settingsError } = await supabase
        .from('todo_settings')
        .upsert(toRemoteSettings(result.store.settings, userId, localTimeZone()))
      if (settingsError) throw settingsError

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
    // 設定もここで送る。送らないと、次の全同期でサーバーの値に巻き戻ってしまう。
    const settingsChanged = local.settings.updatedAt > since
    if (todos.length === 0 && graves.length === 0 && !settingsChanged) return

    setStatus('syncing')
    try {
      const supabase = await getSupabase()
      const now = new Date().toISOString()
      if (todos.length > 0) {
        const { error: e } = await supabase
          .from('todo_items')
          .upsert(todos.map((t) => toRemoteTodo(t, userId)))
        if (e) throw e
      }
      const deadTodos = graves.filter((g) => g.kind === 'todo').map((g) => g.id)
      const deadCategories = graves.filter((g) => g.kind === 'category').map((g) => g.id)
      if (deadTodos.length > 0) {
        await supabase
          .from('todo_items')
          .update({ deleted_at: now, updated_at: now })
          .in('id', deadTodos)
      }
      if (deadCategories.length > 0) {
        await supabase
          .from('todo_categories')
          .update({ deleted_at: now, updated_at: now })
          .in('id', deadCategories)
      }
      if (settingsChanged) {
        const { error: e } = await supabase
          .from('todo_settings')
          .upsert(toRemoteSettings(local.settings, userId, localTimeZone()))
        if (e) throw e
      }

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
