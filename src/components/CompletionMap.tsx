import { useMemo } from 'react'
import type { Todo } from '../types'
import { buildHistory, monthLabels } from '../lib/history'
import { formatDueLabel } from '../lib/date'

type Props = {
  todos: Todo[]
  today: string
}

const WEEKDAY_ROWS = ['', '月', '', '水', '', '金', '']

/**
 * 完了の記録を濃淡で見せる。
 *
 * 何をやったかではなく、どれだけ動いたかを一目で出す。
 * 数字だけだと「今週 12 件」が多いのか少ないのか分からないが、
 * 半年ぶんを並べると自分の平常運転が分かる。
 */
export function CompletionMap({ todos, today }: Props) {
  const history = useMemo(() => buildHistory(todos, today), [todos, today])
  const labels = useMemo(() => monthLabels(history.days), [history.days])

  // 週ごとの列に切り直す。
  const weeks = useMemo(() => {
    const out: (typeof history.days)[] = []
    for (let i = 0; i < history.days.length; i += 7) out.push(history.days.slice(i, i + 7))
    return out
  }, [history.days])

  if (history.total === 0) {
    return (
      <p className="map__empty">
        タスクを終わらせると、ここに記録が残ります。
      </p>
    )
  }

  return (
    <div className="map">
      <dl className="map__stats">
        <div>
          <dt>この半年</dt>
          <dd>
            {history.total}
            <small>件</small>
          </dd>
        </div>
        <div>
          <dt>連続</dt>
          <dd>
            {history.streak}
            <small>日</small>
          </dd>
        </div>
        <div>
          <dt>最長</dt>
          <dd>
            {history.bestStreak}
            <small>日</small>
          </dd>
        </div>
        <div>
          <dt>1日あたり</dt>
          <dd>
            {history.perDay}
            <small>件</small>
          </dd>
        </div>
      </dl>

      {/* 曜日の見出しは動かさない。一緒に流すと、右端（＝今日）を見ているときに消える。 */}
      <div className="map__body">
        <div className="map__rows" aria-hidden="true">
          <span className="map__rows-spacer" />
          {WEEKDAY_ROWS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>

        <div className="map__scroll">
          <div className="map__inner">
            <div className="map__months" aria-hidden="true">
              {labels.map((label, i) => (
                <span key={i}>{label}</span>
              ))}
            </div>

            <div className="map__grid" role="img" aria-label={`直近半年で ${history.total} 件を完了`}>
              {weeks.map((week, wi) => (
                <div className="map__week" key={wi}>
                  {week.map((day) => (
                    <span
                      key={day.date}
                      className="map__day"
                      data-level={day.level}
                      data-future={day.date > today ? '' : undefined}
                      title={`${formatDueLabel(day.date, today)} ${day.count} 件`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="map__legend" aria-hidden="true">
        <span>少</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className="map__day" data-level={l} />
        ))}
        <span>多</span>
      </p>
    </div>
  )
}
