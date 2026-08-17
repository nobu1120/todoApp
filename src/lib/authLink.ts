/**
 * メールのログインリンクから、確認用トークンを取り出す。
 *
 * リンクをタップすると Supabase は redirect_to へ飛ばすが、その戻り先が
 * 許可リストに無いとプロジェクトの Site URL（＝別アプリ）に差し替えられる。
 * その場合ログイン自体は成立しているのに、こちらのアプリには戻ってこない。
 *
 * リンクを「開かずにコピー」して貼ってもらえば、リダイレクトを介さず
 * verifyOtp でセッションを作れる。許可リストの設定が済むまでの逃げ道。
 */

export type OtpType = 'magiclink' | 'signup' | 'invite' | 'recovery' | 'email_change' | 'email'

const OTP_TYPES: OtpType[] = [
  'magiclink',
  'signup',
  'invite',
  'recovery',
  'email_change',
  'email',
]

export type ParsedAuthLink = {
  tokenHash: string
  type: OtpType
}

/** トークンとして妥当な形か。リンクの取り違えを早めに弾く。 */
const looksLikeToken = (value: string) => /^[A-Za-z0-9_-]{16,}$/.test(value)

export function parseAuthLink(input: string): ParsedAuthLink | null {
  const trimmed = input.trim()
  if (trimmed === '') return null

  // まず URL として読む。token / token_hash のどちらの名前でも拾う。
  try {
    const url = new URL(trimmed)
    const params = url.searchParams
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
    const token =
      params.get('token_hash') ??
      params.get('token') ??
      hashParams.get('token_hash') ??
      hashParams.get('token')

    if (token !== null && looksLikeToken(token)) {
      const rawType = params.get('type') ?? hashParams.get('type') ?? 'magiclink'
      return {
        tokenHash: token,
        type: OTP_TYPES.includes(rawType as OtpType) ? (rawType as OtpType) : 'magiclink',
      }
    }
    return null
  } catch {
    // URL ではない。トークンだけを貼られた場合として扱う。
    return looksLikeToken(trimmed) ? { tokenHash: trimmed, type: 'magiclink' } : null
  }
}
