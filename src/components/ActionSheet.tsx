import { useEffect, useRef } from 'react'
import { Icon } from './Icon'

type Props = {
  /** 何についての操作か。表題に出す。 */
  title: string
  onRemove: () => void
  onClose: () => void
}

/**
 * 長押しして離したときに出す操作の一覧。
 *
 * 削除しか無いが、下から出す形にしておくと後から足せる。
 * 誤って開いても、外を触れば閉じる。
 */
export function ActionSheet({ title, onRemove, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={`${title} の操作`}>
      <button
        type="button"
        className="sheet__scrim"
        onClick={onClose}
        aria-label="閉じる"
        tabIndex={-1}
      />
      <div className="sheet__panel" ref={ref} tabIndex={-1}>
        <p className="sheet__title">{title}</p>
        <button type="button" className="sheet__item sheet__item--danger" onClick={onRemove}>
          <Icon name="trash" />
          削除する
        </button>
        <button type="button" className="sheet__item" onClick={onClose}>
          キャンセル
        </button>
      </div>
    </div>
  )
}
