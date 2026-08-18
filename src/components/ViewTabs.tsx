import { useRef } from 'react'

export type ViewMode = 'list' | 'calendar'

type Props = {
  view: ViewMode
  onChange: (view: ViewMode) => void
}

const TABS: { value: ViewMode; label: string }[] = [
  { value: 'list', label: 'リスト' },
  { value: 'calendar', label: 'カレンダー' },
]

/*
 * role="tab" を名乗る以上、矢印キーで移動できて、Tab キーでは
 * 選択中の 1 つにしか止まらない（roving tabindex）必要がある。
 * 中身側には role="tabpanel" と aria-labelledby を付ける。
 */
export function ViewTabs({ view, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    const index = TABS.findIndex((t) => t.value === view)
    const next = TABS[(index + step + TABS.length) % TABS.length]
    onChange(next.value)
    // 選択の移動に合わせて実際の focus も移す。
    ref.current?.querySelector<HTMLButtonElement>(`#view-tab-${next.value}`)?.focus()
  }

  return (
    <div
      className="view-tabs"
      role="tablist"
      aria-label="表示の切り替え"
      ref={ref}
      onKeyDown={onKeyDown}
    >
      {TABS.map((tab) => (
        <button
          key={tab.value}
          id={`view-tab-${tab.value}`}
          type="button"
          role="tab"
          className="view-tab"
          aria-selected={view === tab.value}
          aria-controls={`view-panel-${tab.value}`}
          tabIndex={view === tab.value ? 0 : -1}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
