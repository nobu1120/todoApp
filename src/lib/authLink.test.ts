import { describe, expect, it } from 'vitest'
import { parseAuthLink } from './authLink'

const TOKEN = 'c3f5a68ac2b2ebd4c200181676564863353c5905754d16eb5701a443'

describe('parseAuthLink', () => {
  it('実際のログインリンクからトークンと種別を取り出す', () => {
    const link = `https://agusbaypthehohpqaigc.supabase.co/auth/v1/verify?token=${TOKEN}&type=magiclink&redirect_to=https%3A%2F%2Fexample.com`
    expect(parseAuthLink(link)).toEqual({ tokenHash: TOKEN, type: 'magiclink' })
  })

  it('token_hash という名前でも拾う', () => {
    expect(parseAuthLink(`https://x.example/verify?token_hash=${TOKEN}&type=email`)).toEqual({
      tokenHash: TOKEN,
      type: 'email',
    })
  })

  it('ハッシュ側に付いていても拾う', () => {
    expect(parseAuthLink(`https://x.example/#token=${TOKEN}&type=signup`)).toEqual({
      tokenHash: TOKEN,
      type: 'signup',
    })
  })

  it('種別が無ければ magiclink とみなす', () => {
    expect(parseAuthLink(`https://x.example/verify?token=${TOKEN}`)?.type).toBe('magiclink')
  })

  it('知らない種別は magiclink に落とす', () => {
    expect(parseAuthLink(`https://x.example/verify?token=${TOKEN}&type=なにか`)?.type).toBe(
      'magiclink',
    )
  })

  it('トークンだけを貼られても受け付ける', () => {
    expect(parseAuthLink(`  ${TOKEN}  `)).toEqual({ tokenHash: TOKEN, type: 'magiclink' })
  })

  it('前後の空白を落とす', () => {
    expect(parseAuthLink(`\n https://x.example/verify?token=${TOKEN} \n`)?.tokenHash).toBe(TOKEN)
  })

  it('トークンが無いリンクは受け付けない', () => {
    expect(parseAuthLink('https://nobu1120.github.io/todoApp/')).toBeNull()
    expect(parseAuthLink('https://x.example/verify?type=magiclink')).toBeNull()
  })

  it('短すぎる値や空文字は受け付けない', () => {
    expect(parseAuthLink('')).toBeNull()
    expect(parseAuthLink('   ')).toBeNull()
    expect(parseAuthLink('abc')).toBeNull()
    expect(parseAuthLink('https://x.example/verify?token=abc')).toBeNull()
  })

  it('記号を含む文字列はトークンとみなさない', () => {
    expect(parseAuthLink('これはリンクではありません、長さだけはそこそこあります')).toBeNull()
  })
})
