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

  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
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
  }, [open, onClose])

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
