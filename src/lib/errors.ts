/**
 * 通信の失敗を、利用者が読める日本語にする。
 *
 * 元の文言（'Failed to fetch' など）をそのまま画面に出していたが、
 * 英語のうえに対処のしようがなく、「送れなかったのか」「送れたが
 * 表示が出ないのか」も分からなかった。
 * 原文は details の中に残して、こちらから調べるときの手掛かりにする。
 */

export type FriendlyError = {
  /** 画面に出す本文。 */
  message: string
  /** 元の文言。畳んだ中に置く。 */
  detail: string | null
}

const RULES: { test: RegExp; message: string }[] = [
  {
    test: /failed to fetch|networkerror|network request failed|load failed/i,
    message: '通信できませんでした。電波の状態を確かめて、もう一度お試しください。',
  },
  {
    test: /rate limit|too many requests|429/i,
    message: '送信の間隔が短すぎます。少し待ってからお試しください。',
  },
  {
    /*
     * リンクの失効だけを拾う。'invalid' だけで見ると
     * 'invalid input syntax'（DB の型エラー）まで
     * 「リンクが無効」と言ってしまう。
     */
    test: /otp|magic ?link|(invalid|expired).*(token|link|code)|(token|link|code).*(invalid|expired)/i,
    message: 'このリンクは使えません。もう一度リンクを送ってからお試しください。',
  },
  {
    test: /jwt|token|unauthorized|401|403/i,
    message: 'ログインの期限が切れています。もう一度ログインしてください。',
  },
]

export function friendly(err: unknown): FriendlyError {
  const raw = err instanceof Error ? err.message : String(err)
  const hit = RULES.find((rule) => rule.test.test(raw))
  return hit === undefined
    ? { message: 'うまくいきませんでした。時間をおいてお試しください。', detail: raw }
    : { message: hit.message, detail: raw }
}
