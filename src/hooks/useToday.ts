import { useEffect, useState } from 'react'
import { todayISO } from '../lib/date'

/**
 * 「今日」の日付を保持する。アプリを開きっぱなしで日付をまたいでも
 * 期限切れ判定がずれないよう、1分ごとに見直す。
 */
export function useToday(): string {
  const [today, setToday] = useState(todayISO)

  useEffect(() => {
    const timer = setInterval(() => {
      setToday((current) => {
        const next = todayISO()
        return next === current ? current : next
      })
    }, 60_000)
    return () => clearInterval(timer)
  }, [])

  return today
}
