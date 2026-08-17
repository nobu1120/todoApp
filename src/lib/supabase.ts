import { createClient } from '@supabase/supabase-js'

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

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // メールのリンクから戻ってきたときにセッションを拾う。
    detectSessionInUrl: true,
  },
})

/** この端末の時間帯。期限の「その土地の時刻」をサーバーが解釈するのに要る。 */
export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo'
  } catch {
    return 'Asia/Tokyo'
  }
}
