import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

/**
 * 詳細と設定で使う共通のパネル。
 * デスクトップでは右から、スマホでは下から出る（CSS 側で切り替え）。
 */
export function Drawer({ open, title, onClose, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  // onClose は呼び出し側で毎回作られる無名関数なので、
  // 依存配列に入れると再レンダーのたびに効果が張り直される。
  // 履歴を積む処理がそれをやると pushState が無限に増えるため、ref 経由で参照する。
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKeyDown)

    // 開いた直後にパネルへフォーカスを移し、キーボード操作の起点を合わせる。
    panelRef.current?.focus()

    // 背後の一覧がスクロールしないように止める。
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previous
    }
  }, [open])

  /**
   * スマホの「戻る」でパネルを閉じる。
   * 履歴を 1 つ積んでおき、popstate で閉じる。
   * 戻る以外（×・Esc・背景タップ）で閉じたときは、積んだぶんを自分で戻して
   * 履歴に余りを残さない（残すと、戻るを 2 回押さないとページを離れられなくなる）。
   */
  useEffect(() => {
    if (!open) return

    window.history.pushState({ __drawer: true }, '')
    const onPopState = () => onCloseRef.current()
    window.addEventListener('popstate', onPopState)

    return () => {
      window.removeEventListener('popstate', onPopState)
      // popstate で閉じた場合は既に積んだ状態が外れているので、二重には戻さない。
      if (window.history.state?.__drawer === true) window.history.back()
    }
  }, [open])

  if (!open) return null

  return (
    <div className="drawer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="drawer__backdrop" onClick={onClose} />
      <div className="drawer__panel" ref={panelRef} tabIndex={-1}>
        <header className="drawer__header">
          <h2 className="drawer__title">{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="閉じる">
            <Icon name="close" />
          </button>
        </header>
        <div className="drawer__body">{children}</div>
      </div>
    </div>
  )
}
