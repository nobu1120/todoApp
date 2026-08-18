// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DataNotice } from './DataNotice'

afterEach(cleanup)

const props = {
  syncError: null as string | null,
  signedIn: false,
  authPending: false,
  count: 0,
  onOpenAccount: vi.fn(),
  onOpenSettings: vi.fn(),
  onDismiss: vi.fn(),
  showLocalOnly: true,
}

describe('データの警告', () => {
  it('同期に失敗していたら、その場で分かるように出す', () => {
    // これが見えなかったせいで、書き込みが全部失敗していることに気づけなかった。
    render(<DataNotice {...props} signedIn syncError="タスクの保存: invalid input syntax for type uuid" />)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText(/同期できていません/)).toBeTruthy()
    // 生の英語ではなく、読める日本語を出す（原文は details の中）。
    expect(screen.queryByText(/invalid input syntax/)).toBeNull()
    expect(screen.getByText(/時間をおいて/)).toBeTruthy()
  })

  it('通信の失敗は「電波を確かめて」と言う', () => {
    render(<DataNotice {...props} signedIn syncError="TypeError: Failed to fetch" />)
    expect(screen.getByText(/電波の状態/)).toBeTruthy()
  })

  it('同期の失敗は、ログインしていてもいなくても出す', () => {
    render(<DataNotice {...props} signedIn={false} count={3} syncError="設定の保存: 失敗" />)
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('ログインしていなくてタスクがあれば、端末内だけであることを知らせる', () => {
    render(<DataNotice {...props} count={3} />)
    expect(screen.getByText(/この端末の中だけ/)).toBeTruthy()
    expect(screen.getByText(/閲覧データを消すと/)).toBeTruthy()
  })

  it('「あとで」を選んでいるあいだは出さない', () => {
    const { container } = render(<DataNotice {...props} count={30} showLocalOnly={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('「あとで」を押したことは伝わる', () => {
    const onDismiss = vi.fn()
    render(<DataNotice {...props} count={30} onDismiss={onDismiss} />)
    screen.getByRole('button', { name: 'あとで' }).click()
    expect(onDismiss).toHaveBeenCalled()
  })

  it('タスクが無いうちは出さない（初めて開いた人を驚かせない）', () => {
    const { container } = render(<DataNotice {...props} count={0} />)
    expect(container.firstChild).toBeNull()
  })

  it('ログイン状態を確かめている間は、未ログインと決めつけない', () => {
    // 読み込みに失敗しただけなのに「この端末の中だけ」と出して
    // 誤って安心させる経路があった。
    const { container } = render(<DataNotice {...props} authPending count={5} />)
    expect(container.firstChild).toBeNull()
  })

  it('確かめている最中でも、同期の失敗は隠さない', () => {
    render(<DataNotice {...props} authPending syncError="ログイン状態を確かめられませんでした" />)
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('ログイン済みで問題が無ければ出さない', () => {
    const { container } = render(<DataNotice {...props} signedIn count={5} />)
    expect(container.firstChild).toBeNull()
  })

  it('その場から控えの書き出しへ行ける', () => {
    // ログインはヘッダーにあるので、ここには置かない（同じ画面にボタンが 2 つ並ぶ）。
    const onOpenSettings = vi.fn()
    render(<DataNotice {...props} count={2} onOpenSettings={onOpenSettings} />)
    fireEvent.click(screen.getByText('控えを書き出す'))
    expect(onOpenSettings).toHaveBeenCalled()
  })

  it('同期の失敗からはアカウント画面へ行ける', () => {
    const onOpenAccount = vi.fn()
    render(<DataNotice {...props} signedIn syncError="失敗" onOpenAccount={onOpenAccount} />)
    fireEvent.click(screen.getByText('確認'))
    expect(onOpenAccount).toHaveBeenCalled()
  })
})
