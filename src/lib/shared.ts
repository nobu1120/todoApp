/**
 * 共有シート（PWA の share_target）から流れてきた内容を、タスクの素にする。
 *
 * 「思いついてから登録し終わるまで」が競合との最大の差なので、
 * 他のアプリから 1 タップで放り込めるようにする。
 *
 * 送られ方は端末でまちまち:
 *   - Android Chrome: title / text / url が分かれて来る
 *   - iOS Safari:     title を送らず、text に「ページ名 URL」を詰めることがある
 * どれで来ても題名と詳細に振り分ける。
 */

export type SharedTask = {
  title: string
  /** 参照元の URL など。詳細メモに入れる。 */
  notes: string
}

const URL_RE = /https?:\/\/\S+/

export function sharedTask(params: URLSearchParams): SharedTask | null {
  const title = (params.get('title') ?? '').trim()
  const text = (params.get('text') ?? '').trim()
  const url = (params.get('url') ?? '').trim()
  // ホーム画面のショートカットからは ?add= で来る。中身があれば題名として使う。
  const add = (params.get('add') ?? '').trim()

  if (add !== '') return { title: add, notes: '' }
  if (title === '' && text === '' && url === '') return null

  if (title !== '') {
    // 題名がある。url があればそちら、無ければ text を詳細へ。
    return { title, notes: url !== '' ? url : text }
  }

  if (text !== '') {
    // 題名が無い。text の中に URL が混ざっていれば切り離す。
    const found = url !== '' ? url : (text.match(URL_RE)?.[0] ?? '')
    const rest = found === '' ? text : text.replace(found, '').trim()
    return rest === '' ? { title: found, notes: '' } : { title: rest, notes: found }
  }

  return { title: url, notes: '' }
}
