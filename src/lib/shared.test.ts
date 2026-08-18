import { describe, expect, it } from 'vitest'
import { sharedTask } from './shared'

const q = (s: string) => sharedTask(new URLSearchParams(s))

describe('共有シートから受け取る', () => {
  it('題名だけが来たらそれを使う', () => {
    expect(q('title=%E8%B3%87%E6%96%99%E3%82%92%E8%AA%AD%E3%82%80')).toEqual({
      title: '資料を読む', notes: '',
    })
  })

  it('URL は本文ではなく詳細に入れる', () => {
    const r = q('title=Supabase&url=https%3A%2F%2Fsupabase.com%2Fdocs')
    expect(r?.title).toBe('Supabase')
    expect(r?.notes).toBe('https://supabase.com/docs')
  })

  it('題名が無ければ本文を題名にする', () => {
    expect(q('text=%E7%89%9B%E4%B9%B3%E3%82%92%E8%B2%B7%E3%81%86')).toEqual({
      title: '牛乳を買う', notes: '',
    })
  })

  it('Safari のように本文へ URL が入ってくる場合も拾う', () => {
    // iOS は title を送らず、text に「ページ名 URL」を入れてくることがある
    const r = q('text=Supabase%20https%3A%2F%2Fsupabase.com%2Fdocs')
    expect(r?.title).toBe('Supabase')
    expect(r?.notes).toBe('https://supabase.com/docs')
  })

  it('URL だけなら URL を題名にする', () => {
    const r = q('url=https%3A%2F%2Fexample.com')
    expect(r?.title).toBe('https://example.com')
    expect(r?.notes).toBe('')
  })

  it('題名と本文が両方あれば、本文は詳細へ', () => {
    const r = q('title=%E8%AB%96%E6%96%87&text=%E8%A6%81%E7%B4%84%E3%81%99%E3%82%8B')
    expect(r?.title).toBe('論文')
    expect(r?.notes).toBe('要約する')
  })

  it('空の共有は無視する', () => {
    expect(q('title=&text=&url=')).toBeNull()
    expect(q('')).toBeNull()
  })

  it('ショートカットの ?add= は空でも「追加したい」の合図として扱わない', () => {
    // 空欄で開くだけ。タスクは作らない。
    expect(q('add=')).toBeNull()
  })

  it('?add=本文 なら、その本文で作る', () => {
    expect(q('add=%E7%89%9B%E4%B9%B3')).toEqual({ title: '牛乳', notes: '' })
  })
})
