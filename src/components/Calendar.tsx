import {
  WEEKDAY_LABELS,
  addMonths,
  formatMonthLabel,
  monthGrid,
  type DayCount,
  type YearMonth,
} from '../lib/calendar'
import { Icon } from './Icon'

type Props = {
  month: YearMonth
  selected: string
  today: string
  counts: Record<string, DayCount>
  onChangeMonth: (next: YearMonth) => void
  onSelect: (date: string) => void
}

export function Calendar({ month, selected, today, counts, onChangeMonth, onSelect }: Props) {
  const weeks = monthGrid(month)

  return (
    <div className="calendar">
      <div className="calendar__head">
        <button
          type="button"
          className="icon-button"
          onClick={() => onChangeMonth(addMonths(month, -1))}
          aria-label="前の月"
        >
          <span className="calendar__prev">
            <Icon name="chevron" />
          </span>
        </button>

        <h2 className="calendar__month">{formatMonthLabel(month)}</h2>

        <button
          type="button"
          className="icon-button"
          onClick={() => onChangeMonth(addMonths(month, 1))}
          aria-label="次の月"
        >
          <span className="calendar__next">
            <Icon name="chevron" />
          </span>
        </button>
      </div>

      <div className="calendar__weekdays" aria-hidden="true">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="calendar__weekday">
            {label}
          </span>
        ))}
      </div>

      <div className="calendar__grid" role="grid" aria-label={formatMonthLabel(month)}>
        {weeks.map((week, i) => (
          <div className="calendar__week" role="row" key={i}>
            {week.map((day) => {
              const count = counts[day.date]
              /*
               * 帯の途中の日は count が「件数 0・印だけ」で入る。
               * has で弾かないと、pending が 0 なので「全て完了」の印になってしまう。
               */
              const has = count !== undefined && count.total > 0
              const pending = has ? count.total - count.done : 0
              const allDone = has && pending === 0
              const [, , dd] = day.date.split('-')

              return (
                <button
                  key={day.date}
                  type="button"
                  role="gridcell"
                  data-date={day.date}
                  className={
                    'calendar__day' +
                    (day.inMonth ? '' : ' calendar__day--outside') +
                    (day.date === selected ? ' is-selected' : '') +
                    (day.date === today ? ' is-today' : '') +
                    (count?.span === true ? ' has-span' : '')
                  }
                  aria-selected={day.date === selected}
                  onClick={() => onSelect(day.date)}
                >
                  <span className="calendar__num">{Number(dd)}</span>
                  {/* 件数は点で示す。3 件を超えたら「+」で頭打ちにして、マスを崩さない。 */}
                  <span className="calendar__marks" aria-hidden="true">
                    {has &&
                      (allDone ? (
                        <span className="calendar__mark calendar__mark--done" />
                      ) : (
                        <>
                          {Array.from({ length: Math.min(pending, 3) }, (_, k) => (
                            <span key={k} className="calendar__mark" />
                          ))}
                          {pending > 3 && <span className="calendar__more">+</span>}
                        </>
                      ))}
                  </span>
                  {has && (
                    <span className="visually-hidden">
                      {pending > 0 ? `未完了 ${pending} 件` : '全て完了'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
