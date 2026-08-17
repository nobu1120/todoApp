import type { Todo } from '../types'
import type { StatusFilter } from '../types'
import { Icon } from './Icon'

type Props = {
  overdue: Todo[]
  dueToday: Todo[]
  onJump: (status: StatusFilter) => void
}

/**
 * 閉じている間に来た期限は OS 通知では拾えないので、
 * 開いたときに「対応が要るもの」をここでまとめて突きつける。
 */
export function ReminderBanner({ overdue, dueToday, onJump }: Props) {
  if (overdue.length === 0 && dueToday.length === 0) return null

  return (
    <div className="reminder" role="status">
      {overdue.length > 0 && (
        <button type="button" className="reminder__item reminder__item--overdue" onClick={() => onJump('overdue')}>
          <Icon name="alert" />
          <span>
            期限切れ <strong>{overdue.length}</strong> 件
          </span>
        </button>
      )}
      {dueToday.length > 0 && (
        <button type="button" className="reminder__item reminder__item--today" onClick={() => onJump('today')}>
          <Icon name="bell" />
          <span>
            今日まで <strong>{dueToday.length}</strong> 件
          </span>
        </button>
      )}
    </div>
  )
}
