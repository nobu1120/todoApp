import type { SupabaseClient } from '@supabase/supabase-js'

/*
 * 接続先。anon キーは「公開してよい鍵」で、実際の権限は RLS が決める。
 * リポジトリが public でも問題ない設計になっている
 * （service_role キーだけは絶対にここへ置かない）。
 *
 * quiz プロジェクトに相乗りしているため、テーブル名は todo_ で始まる。
 */
export const SUPABASE_URL = 'https://roofopskzyfpttnsyuwu.supabase.co'
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvb2ZvcHNrenlmcHR0bnN5dXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MzA0NTcsImV4cCI6MjA5OTMwNjQ1N30.ZXSdss9UoijFiihQFIs0RugNOELn8gbDCxkfV51TqRo'

/** Web Push の公開鍵。秘密鍵はサーバー側にしか無い。 */
export const VAPID_PUBLIC_KEY =
  'BMOI9dagHrkXpY-2Nt_k2FcZDU-oKEqZhEp8FU1CJQn8Vl2ERkqBG2MEqFVuEAvbeGPB11aDNWihq5BLk-jjIdU'

/**
 * Supabase のクライアントは動的に読み込む。
 *
 * 実測で JS の 46%（220KB）がこのライブラリで、ログインしない人にも
 * 配っていた。ログインは任意の機能なので、必要になるまで読まない。
 *
 * 「必要になるまで」は 2 つ:
 *   - 前にログインした痕跡が localStorage にある（＝すぐ同期したい）
 *   - アカウント画面を開いた / ログイン操作をした
 */
let clientPromise: Promise<SupabaseClient> | null = null

export function getSupabase(): Promise<SupabaseClient> {
  if (clientPromise === null) {
    clientPromise = import('@supabase/supabase-js')
      .then(({ createClient }) =>
        createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            // メールのリンクから戻ってきたときにセッションを拾う。
            detectSessionInUrl: true,
          },
        }),
      )
      .catch((err) => {
        // 失敗した Promise を握ったままにすると、以後の操作が全部失敗し続ける。
        // 次の機会に読み直せるよう捨てる（圏外・古いキャッシュ・配信直後など）。
        clientPromise = null
        throw err
      })
  }
  return clientPromise
}

/** 参照だけ。まだ読み込んでいなければ読み込まない。 */
export function loadedSupabase(): Promise<SupabaseClient> | null {
  return clientPromise
}

/**
 * ログイン済みかもしれないか。Supabase はセッションを
 * 'sb-<プロジェクト>-auth-token' という名前で localStorage に置く。
 * これがあるときだけ、起動時に本体を読み込む。
 */
export function hasStoredSession(): boolean {
  try {
    const ref = new URL(SUPABASE_URL).hostname.split('.')[0]
    if (localStorage.getItem(`sb-${ref}-auth-token`) !== null) return true
    // メールのリンクから戻ってきた直後は、まだ保存されていない。
    return window.location.hash.includes('access_token') || window.location.search.includes('code=')
  } catch {
    return false
  }
}

/** この端末の時間帯。期限の「その土地の時刻」をサーバーが解釈するのに要る。 */
export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo'
  } catch {
    return 'Asia/Tokyo'
  }
}
