import { useRef, useState } from 'react'
import type { TodoStore } from '../types'
import { backupFileName, parseBackup, toBackup } from '../lib/backup'

type Props = {
  store: TodoStore
  onImport: (incoming: TodoStore) => number
}

/**
 * 書き出し / 読み込み。
 * ログインしない使い方だとデータはこの端末にしか無いので、
 * 持ち出せる形を 1 つ用意しておく。
 */
export function DataPanel({ store, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  function handleExport() {
    const json = JSON.stringify(toBackup(store), null, 2)
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = backupFileName()
    // Firefox は DOM に入っていない要素のクリックを無視する。
    document.body.appendChild(a)
    a.click()
    a.remove()
    // 即座に解放するとダウンロードが始まる前に切れることがある。
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    setMessage({ ok: true, text: `${store.todos.length} 件を書き出しました。` })
  }

  /** 人が選ぶファイルなので、いくらでも大きいものが来うる。 */
  const MAX_BYTES = 20 * 1024 * 1024

  async function handleFile(file: File) {
    if (file.size > MAX_BYTES) {
      setMessage({
        ok: false,
        text: `ファイルが大きすぎます（${Math.round(file.size / 1024 / 1024)}MB）。このアプリの書き出しファイルではないようです。`,
      })
      return
    }
    const result = parseBackup(await file.text())
    if (!result.ok) {
      setMessage({ ok: false, text: result.reason })
      return
    }
    const added = onImport(result.store)
    setMessage({
      ok: true,
      text:
        added === 0
          ? `${result.todos} 件を読み込みました（すべて既にあるものでした）。`
          : `${result.todos} 件を読み込み、${added} 件を追加しました。`,
    })
  }

  return (
    <>
      <p className="detail__hint">
        ログインしていない場合、データはこの端末の中だけにあります。
        端末を替えるときや、念のための控えに使ってください。
      </p>

      <div className="chip-row">
        <button type="button" onClick={handleExport}>
          書き出す（JSON）
        </button>
        <button type="button" onClick={() => fileRef.current?.click()}>
          読み込む
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            // 同じファイルを続けて選べるよう、値を戻しておく。
            e.target.value = ''
            if (file !== undefined) void handleFile(file)
          }}
        />
      </div>

      <p className="detail__hint">
        読み込みは<strong>置き換えではなく追加</strong>です。同じタスクは更新が新しいほうを残します。
      </p>

      {message !== null && (
        <p className={`detail__hint${message.ok ? '' : ' detail__hint--warn'}`} role="status">
          {message.text}
        </p>
      )}
    </>
  )
}
