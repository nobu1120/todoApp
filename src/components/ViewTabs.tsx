export type ViewMode = 'list' | 'calendar'

type Props = {
  view: ViewMode
  onChange: (view: ViewMode) => void
}

const TABS: { value: ViewMode; label: string }[] = [
  { value: 'list', label: 'リスト' },
  { value: 'calendar', label: 'カレンダー' },
]

export function ViewTabs({ view, onChange }: Props) {
  return (
    <div className="view-tabs" role="tablist" aria-label="表示の切り替え">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          className="view-tab"
          aria-selected={view === tab.value}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
