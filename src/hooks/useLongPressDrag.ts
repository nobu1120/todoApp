import { useCallback, useEffect, useRef, useState } from 'react'

/** 長押しと判定するまでの時間。短いとスクロールのたびに反応する。 */
const HOLD_MS = 450
/** これ以上動いたら「スクロールしたい」とみなして長押しを取り消す。 */
const SLOP = 8

export type DragState = {
  /** つかんでいるタスク。null なら何も起きていない。 */
  id: string | null
  /** いま指がある位置に対応する挿入先（この id の直前に入る）。null は末尾。 */
  before: string | null
}

type Options = {
  /** 並びを確定する。 */
  onDrop: (id: string, before: string | null) => void
  /** 長押ししたまま動かさずに離した。 */
  onHold: (id: string) => void
  /** 触らせない状態（選択モード中など）。 */
  disabled?: boolean
}

/**
 * 長押しから始まる 1 つのジェスチャーで、並べ替えとメニューの両方を出す。
 *
 *   押す → 450ms 待つ → つかむ
 *     動かす  → 並べ替え
 *     動かさず離す → メニュー
 *
 * 450ms より前に動いたら、それはスクロールなので何もしない。
 * つかんだ後は touchmove を止める（止めないと画面ごと動いて操作にならない）。
 * React の onTouchMove は passive なので preventDefault できない。
 * そのため addEventListener を自分で張っている。
 */
export function useLongPressDrag({ onDrop, onHold, disabled = false }: Options) {
  const [drag, setDrag] = useState<DragState>({ id: null, before: null })
  const listRef = useRef<HTMLUListElement>(null)

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startY = useRef(0)
  const held = useRef(false)
  const moved = useRef(false)
  const pressedId = useRef<string | null>(null)
  const dragRef = useRef<DragState>({ id: null, before: null })

  const set = (next: DragState) => {
    dragRef.current = next
    setDrag(next)
  }

  const cancelTimer = () => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }

  const reset = useCallback(() => {
    cancelTimer()
    held.current = false
    moved.current = false
    pressedId.current = null
    set({ id: null, before: null })
  }, [])

  /** 指の位置から挿入先を決める。行の上半分なら「その行の前」。 */
  const targetAt = useCallback((y: number): string | null => {
    const list = listRef.current
    if (list === null) return null
    const rows = [...list.querySelectorAll<HTMLElement>('[data-todo-id]')]
    for (const row of rows) {
      if (row.dataset.todoId === pressedId.current) continue
      const box = row.getBoundingClientRect()
      if (y < box.top + box.height / 2) return row.dataset.todoId ?? null
    }
    return null
  }, [])

  const onPointerDown = useCallback(
    (id: string, clientY: number) => {
      if (disabled) return
      reset()
      pressedId.current = id
      startY.current = clientY
      timer.current = setTimeout(() => {
        held.current = true
        set({ id, before: null })
        // 掴んだことを触覚でも返す（対応していない端末では何も起きない）。
        navigator.vibrate?.(12)
      }, HOLD_MS)
    },
    [disabled, reset],
  )

  useEffect(() => {
    const list = listRef.current
    if (list === null) return

    const onMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY ?? 0
      if (!held.current) {
        // まだ掴んでいない。少しでも動いたらスクロールとみなす。
        if (Math.abs(y - startY.current) > SLOP) reset()
        return
      }
      // 掴んでいる間は画面を動かさない。
      event.preventDefault()
      if (Math.abs(y - startY.current) > SLOP) moved.current = true
      const before = targetAt(y)
      if (before !== dragRef.current.before) {
        set({ id: dragRef.current.id, before })
      }
    }

    list.addEventListener('touchmove', onMove, { passive: false })
    return () => list.removeEventListener('touchmove', onMove)
  }, [reset, targetAt])

  const onPointerUp = useCallback(() => {
    const id = dragRef.current.id
    const before = dragRef.current.before
    const wasHeld = held.current
    const wasMoved = moved.current
    reset()
    if (id === null || !wasHeld) return
    // 動かしていれば並べ替え、動かしていなければメニュー。
    if (wasMoved) onDrop(id, before)
    else onHold(id)
  }, [onDrop, onHold, reset])

  useEffect(() => {
    if (disabled) reset()
  }, [disabled, reset])

  useEffect(() => reset, [reset])

  return { listRef, drag, onPointerDown, onPointerUp, cancel: reset }
}
