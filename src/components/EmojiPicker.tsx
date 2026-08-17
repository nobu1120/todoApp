import { EMOJI_GROUPS } from '../lib/emoji'

type Props = {
  value: string
  onChange: (emoji: string) => void
}

export function EmojiPicker({ value, onChange }: Props) {
  return (
    <div className="emoji-picker">
      <div className="emoji-picker__group">
        <button
          type="button"
          className={`emoji-picker__item emoji-picker__item--none${value === '' ? ' is-selected' : ''}`}
          onClick={() => onChange('')}
          aria-pressed={value === ''}
          aria-label="アイコンなし"
        >
          なし
        </button>
      </div>

      {EMOJI_GROUPS.map((group) => (
        <div key={group.label} className="emoji-picker__group">
          <p className="emoji-picker__label">{group.label}</p>
          <div className="emoji-picker__grid">
            {group.emoji.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={`emoji-picker__item${value === emoji ? ' is-selected' : ''}`}
                onClick={() => onChange(emoji)}
                aria-pressed={value === emoji}
                aria-label={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
