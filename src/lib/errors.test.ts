import { describe, expect, it } from 'vitest'
import { friendly } from './errors'

describe('失敗の文言', () => {
  it('通信できないときは電波を確かめるよう言う', () => {
    expect(friendly(new TypeError('Failed to fetch')).message).toMatch(/電波/)
    expect(friendly('NetworkError when attempting to fetch').message).toMatch(/電波/)
  })

  it('送りすぎは待つよう言う', () => {
    expect(friendly('Email rate limit exceeded').message).toMatch(/少し待って/)
  })

  it('リンクの失効は送り直すよう言う', () => {
    expect(friendly('Token has expired or is invalid').message).toMatch(/リンク/)
    expect(friendly('otp_expired').message).toMatch(/リンク/)
  })

  it('DB の型エラーをリンクの失効と取り違えない', () => {
    const r = friendly('タスクの保存: invalid input syntax for type uuid')
    expect(r.message).not.toMatch(/リンク/)
    expect(r.message).toMatch(/時間をおいて/)
  })

  it('原文は必ず残す', () => {
    expect(friendly(new Error('boom')).detail).toBe('boom')
  })
})
