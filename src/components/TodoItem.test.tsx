// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TodoItem } from './TodoItem'
import { createSubtask, createTodo } from '../lib/todos'
import type { Todo } from '../types'

afterEach(cleanup)

const TODAY = '2026-08-21'

function task(overrides: Partial<Todo> = {}): Todo {
  return { ...createTodo({ title: '掃除' }), ...overrides }
}

function setup(todo: Todo, props: Partial<Parameters<typeof TodoItem>[0]> = {}) {
  const onToggleSubtask = vi.fn()
  render(
    <TodoItem
      todo={todo}
      categories={[]}
      today={TODAY}
      onToggle={vi.fn()}
      onToggleSubtask={onToggleSubtask}
      onToggleCollapsed={vi.fn()}
      onOpen={vi.fn()}
      onRemove={vi.fn()}
      {...props}
    />,
  )
  return { onToggleSubtask }
}

describe('一覧の中のサブタスク', () => {
  const subtasks = [createSubtask('風呂'), { ...createSubtask('台所'), done: true }]

  it('サブタスクをチェックボックス付きで出す', () => {
    setup(task({ subtasks }))
    expect(screen.getByText('風呂')).toBeTruthy()
    expect(screen.getByLabelText('風呂 を完了にする')).toBeTruthy()
    // 済んだものは取り消し線で残す（消すと戻せなくなる）。
    expect(screen.getByLabelText('台所 を未完了に戻す')).toBeTruthy()
  })

  it('チェックすると親とサブタスクの id を返す', () => {
    const todo = task({ subtasks })
    const { onToggleSubtask } = setup(todo)
    fireEvent.click(screen.getByLabelText('風呂 を完了にする'))
    expect(onToggleSubtask).toHaveBeenCalledWith(todo.id, subtasks[0].id)
  })

  it('畳むと隠れる', () => {
    setup(task({ subtasks }), { collapsed: true })
    expect(screen.queryByText('風呂')).toBeNull()
  })

  it('完了した親の下には出さない（行数だけ増えるため）', () => {
    setup(task({ subtasks, done: true }))
    expect(screen.queryByText('風呂')).toBeNull()
  })

  it('選択モードでは押せない（行のタップが「選ぶ」になるため）', () => {
    setup(task({ subtasks }), { selecting: true })
    expect((screen.getByLabelText('風呂 を完了にする') as HTMLInputElement).disabled).toBe(true)
  })

  it('サブタスクが無ければ畳むボタンも出さない', () => {
    setup(task())
    expect(screen.queryByLabelText(/サブタスクを/)).toBeNull()
  })
})
