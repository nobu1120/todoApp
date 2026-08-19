import { useCallback, useEffect, useRef, useState } from 'react'
import type { Memo } from '../types'
import { MEMO_MAX, clampMemo, memoLength } from '../lib/storage'

type Props = {
  memo: Memo
  onChange: (text: string) => void
}

/**
 * どこにも属さない 1 枚のメモ。
 *
 * タスクにするほどでもないもの（買い物の走り書き、電話の要点、下書き）の
 * 置き場所。増やせないのが要点で、増やせると整理する対象が 1 つ増えてしまう。
 *
 * 打つたびに保存する（保存ボタンを置かない）。
 * ただし 1 文字ごとに同期を起こさないよう、少し待ってからまとめて反映する。
 */
export function MemoPanel({ memo, onChange }: Props) {
  const [text, setText] = useState(memo.text)
  const ref = useRef<HTMLTextAreaElement>(null)
  // 反映済みの内容。外から入れ替わったかを見分けるのに使う。
  const applied = useRef(memo.text)

  // 他の端末から届いたぶんを取り込む。自分が打っている最中は上書きしない。
  useEffect(() => {
    if (memo.text === applied.current) return
    applied.current = memo.text
    setText(memo.text)
  }, [memo.text])

  useEffect(() => {
    if (text === applied.current) return
    const timer = setTimeout(() => {
      applied.current = text
      onChange(text)
    }, 400)
    return () => clearTimeout(timer)
  }, [text, onChange])

  /*
   * 開いてすぐ書ける状態にはしない。
   * スマホで自動的にキーボードが出ると、メモの半分が隠れて読めなくなる。
   * 「見に来た」場合のほうが多い前提にして、書くときは 1 タップしてもらう。
   * 触ったときは末尾から続けられるようにする。
   */
  const focusEnd = () => {
    const el = ref.current
    if (el !== null && el.selectionStart === 0 && el.selectionEnd === 0) {
      el.setSelectionRange(el.value.length, el.value.length)
    }
    keepVisible()
  }

  /*
   * 打っているところが見えるようにする。
   *
   * iOS はキーボードが出てもレイアウトの高さが変わらないので、
   * 入力欄がキーボードの下に入ったまま気づけない。
   * visualViewport（実際に見えている範囲）の変化を拾って、そのつど送り直す。
   */
  const keepVisible = useCallback(() => {
    const el = ref.current
    if (el === null || document.activeElement !== el) return
    // キーボードが出きるのを待ってから測る。
    requestAnimationFrame(() => {
      const view = window.visualViewport
      const box = el.getBoundingClientRect()
      const bottom = view === null || view === undefined ? window.innerHeight : view.height
      if (box.bottom <= bottom - 8) return
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }, [])

  useEffect(() => {
    const view = window.visualViewport
    if (view === null || view === undefined) return
    view.addEventListener('resize', keepVisible)
    return () => view.removeEventListener('resize', keepVisible)
  }, [keepVisible])

  const used = memoLength(text)
  const left = MEMO_MAX - used

  return (
    <div className="memo">
      <textarea
        ref={ref}
        className="memo__text"
        value={text}
        onChange={(e) => {
          setText(clampMemo(e.target.value))
          keepVisible()
        }}
        onFocus={focusEnd}
        placeholder="買い物の走り書き、電話の要点、下書きなど"
        aria-label="メモ"
      />
      <p className="memo__hint">
        <span>打つたびに保存します。</span>
        <span
          className="memo__count"
          /* 残りが少ないときだけ色を変える。常に赤いと注意が効かなくなる。 */
          data-state={left === 0 ? 'full' : left <= 50 ? 'near' : undefined}
        >
          {used}/{MEMO_MAX} 字
        </span>
      </p>
    </div>
  )
}
