import { friendly } from '../lib/errors'

/**
 * 失敗の報せ。日本語の本文を出し、原文は畳んだ中に置く。
 */
export function ErrorNote({ error }: { error: string | null }) {
  if (error === null) return null
  const { message, detail } = friendly(error)
  return (
    <p className="detail__hint detail__hint--warn">
      {message}
      {detail !== null && detail !== message && (
        <details className="error-note__raw">
          <summary>詳しく</summary>
          <code>{detail}</code>
        </details>
      )}
    </p>
  )
}
