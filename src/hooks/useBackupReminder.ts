import { useCallback, useEffect, useState } from 'react'
import {
  backupPrompt,
  snoozeUntil,
  type BackupState,
} from '../lib/backupReminder'

const KEY = 'todoApp.backup'

/*
 * 控えの状態は端末ごとの都合（書き出したファイルはその端末にある）なので、
 * 同期する Settings には入れず、この端末だけに置く。
 */
function load(): BackupState {
  const fallback: BackupState = {
    lastBackupAt: null,
    firstRunAt: new Date().toISOString(),
    snoozedUntil: null,
  }
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return fallback
    const parsed = JSON.parse(raw) as Partial<BackupState>
    return {
      lastBackupAt: typeof parsed.lastBackupAt === 'string' ? parsed.lastBackupAt : null,
      firstRunAt: typeof parsed.firstRunAt === 'string' ? parsed.firstRunAt : fallback.firstRunAt,
      snoozedUntil: typeof parsed.snoozedUntil === 'string' ? parsed.snoozedUntil : null,
    }
  } catch {
    return fallback
  }
}

export function useBackupReminder(todoCount: number) {
  const [state, setState] = useState<BackupState>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      // 保存できなくても、この画面のあいだは判断できる。
    }
  }, [state])

  /** 書き出したら呼ぶ。次は 60 日後まで黙る。 */
  const markBackedUp = useCallback(() => {
    setState((s) => ({ ...s, lastBackupAt: new Date().toISOString(), snoozedUntil: null }))
  }, [])

  const dismiss = useCallback(() => {
    setState((s) => ({ ...s, snoozedUntil: snoozeUntil() }))
  }, [])

  return { prompt: backupPrompt(state, todoCount), markBackedUp, dismiss }
}
