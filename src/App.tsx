import { useCallback, useMemo, useState } from 'react'
import type { Filter, StatusFilter } from './types'
import { countActive, filterTodos, matchesStatus, needsAttention, sortTodos } from './lib/todos'
import { useTodos } from './hooks/useTodos'
import { useToday } from './hooks/useToday'
import { useNotifications } from './hooks/useNotifications'
import { useSync } from './hooks/useSync'
import { AccountPanel } from './components/AccountPanel'
import { TodoForm } from './components/TodoForm'
import { FilterBar } from './components/FilterBar'
import { TodoList } from './components/TodoList'
import { ReminderBanner } from './components/ReminderBanner'
import { Drawer } from './components/Drawer'
import { TaskDetail } from './components/TaskDetail'
import { SettingsPanel } from './components/SettingsPanel'
import { Icon } from './components/Icon'

const EMPTY_MESSAGE: Record<StatusFilter, { art: string; title: string }> = {
  all: { art: '🌱', title: 'まだタスクがありません' },
  active: { art: '🍃', title: '未完了のタスクはありません' },
  today: { art: '☕', title: '今日が期限のタスクはありません' },
  overdue: { art: '✨', title: '期限切れはありません' },
  done: { art: '📭', title: '完了したタスクはまだありません' },
}

export default function App() {
  const todo = useTodos()
  const { store } = todo
  const { todos, categories, settings } = store

  const [filter, setFilter] = useState<Filter>({ status: 'all', categoryId: null })
  const [openId, setOpenId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const today = useToday()

  const sync = useSync(store, todo.replaceStore)

  const { permission, enable } = useNotifications({
    todos,
    settings,
    today,
    onNotified: todo.markNotified,
    // 閉じている間ぶんはサーバーが送る。二重に鳴らさないよう、
    // この端末が宛先として登録できている間は画面側のタイマーを止める。
    paused: sync.pushReady,
  })

  const visible = useMemo(() => sortTodos(filterTodos(todos, filter, today)), [todos, filter, today])

  // 「完了」フィルタを選んでいるときは、下の完了セクションと二重になるので分けない。
  const showingDoneFilter = filter.status === 'done'
  const active = showingDoneFilter ? visible : visible.filter((t) => !t.done)
  const done = showingDoneFilter ? [] : visible.filter((t) => t.done)

  const counts = useMemo(() => {
    const inCategory = todos.filter(
      (t) => filter.categoryId === null || t.categoryId === filter.categoryId,
    )
    const count = (status: StatusFilter) =>
      inCategory.filter((t) => matchesStatus(t, status, today)).length
    return {
      all: count('all'),
      active: count('active'),
      today: count('today'),
      overdue: count('overdue'),
      done: count('done'),
    }
  }, [todos, filter.categoryId, today])

  const categoryCounts = useMemo(() => {
    const result: Record<string, number> = {}
    for (const t of todos) {
      if (t.categoryId === null) continue
      if (!matchesStatus(t, filter.status, today)) continue
      result[t.categoryId] = (result[t.categoryId] ?? 0) + 1
    }
    return result
  }, [todos, filter.status, today])

  const categoryUsage = useMemo(() => {
    const result: Record<string, number> = {}
    for (const t of todos) {
      if (t.categoryId === null) continue
      result[t.categoryId] = (result[t.categoryId] ?? 0) + 1
    }
    return result
  }, [todos])

  const attention = useMemo(() => needsAttention(todos, today), [todos, today])
  const openTodo = openId === null ? null : (todos.find((t) => t.id === openId) ?? null)

  const jump = useCallback((status: StatusFilter) => {
    setFilter((f) => ({ ...f, status }))
  }, [])

  const remaining = countActive(todos)

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__headline">
          <p className="app__eyebrow">Todo</p>
          <h1 className="app__remaining">
            {remaining === 0 ? (
              todos.length === 0 ? 'はじめましょう' : 'すべて完了'
            ) : (
              <>
                残り <strong>{remaining}</strong> 件
              </>
            )}
          </h1>
        </div>
        <button
          type="button"
          className="icon-button icon-button--lg"
          onClick={() => setSettingsOpen(true)}
          aria-label="設定"
        >
          <Icon name="settings" />
        </button>
      </header>

      <ReminderBanner overdue={attention.overdue} dueToday={attention.today} onJump={jump} />

      <TodoForm
        categories={categories}
        today={today}
        defaultCategoryId={filter.categoryId}
        onAdd={todo.add}
      />

      <FilterBar
        filter={filter}
        counts={counts}
        categories={categories}
        categoryCounts={categoryCounts}
        onChange={setFilter}
      />

      {active.length === 0 && done.length === 0 ? (
        <div className="empty">
          <p className="empty__art" aria-hidden="true">
            {EMPTY_MESSAGE[filter.status].art}
          </p>
          <p className="empty__title">{EMPTY_MESSAGE[filter.status].title}</p>
          {todos.length === 0 && (
            <p className="empty__hint">上の欄に入力して Enter を押すと追加できます。</p>
          )}
        </div>
      ) : active.length === 0 ? (
        // 残りが 0 件。ただ空欄にせず、終わったことを返す。
        <div className="empty celebrate">
          <p className="empty__art" aria-hidden="true">
            🎉
          </p>
          <p className="empty__title">ぜんぶ終わりました</p>
          <p className="empty__hint">おつかれさま。</p>
        </div>
      ) : (
        <TodoList
          todos={active}
          categories={categories}
          today={today}
          onToggle={todo.toggle}
          onOpen={setOpenId}
          onRemove={todo.remove}
        />
      )}

      {done.length > 0 && (
        <section className="done-section">
          <button
            type="button"
            className="done-section__toggle"
            onClick={() => setShowDone((v) => !v)}
            aria-expanded={showDone}
          >
            <span className={`done-section__chevron${showDone ? ' is-open' : ''}`}>
              <Icon name="chevron" />
            </span>
            完了 <span className="filter__count">{done.length}</span>
          </button>
          {showDone && (
            <TodoList
              todos={done}
              categories={categories}
              today={today}
              onToggle={todo.toggle}
              onOpen={setOpenId}
              onRemove={todo.remove}
            />
          )}
        </section>
      )}

      <Drawer open={openTodo !== null} title="タスクの詳細" onClose={() => setOpenId(null)}>
        {openTodo !== null && (
          <TaskDetail
            todo={openTodo}
            categories={categories}
            onUpdate={(patch) => todo.update(openTodo.id, patch)}
            onAddSubtask={(title) => todo.addSubtask(openTodo.id, title)}
            onToggleSubtask={(sid) => todo.toggleSubtask(openTodo.id, sid)}
            onRenameSubtask={(sid, title) => todo.renameSubtask(openTodo.id, sid, title)}
            onRemoveSubtask={(sid) => todo.removeSubtask(openTodo.id, sid)}
            onRemove={() => {
              todo.remove(openTodo.id)
              setOpenId(null)
            }}
          />
        )}
      </Drawer>

      <Drawer open={settingsOpen} title="設定" onClose={() => setSettingsOpen(false)}>
        <SettingsPanel
          settings={settings}
          permission={permission}
          categories={categories}
          categoryUsage={categoryUsage}
          signedIn={sync.session !== null}
          pushReady={sync.pushReady}
          onUpdateSettings={todo.updateSettings}
          onEnableNotifications={enable}
          onRegisterPush={sync.registerPush}
          onAddCategory={todo.addCategory}
          onUpdateCategory={todo.updateCategory}
          onRemoveCategory={todo.removeCategory}
        >
          <AccountPanel
            email={sync.email}
            status={sync.status}
            error={sync.error}
            onSignIn={sync.signIn}
            onSignOut={sync.signOut}
            onSync={sync.fullSync}
          />
        </SettingsPanel>
      </Drawer>

      {todo.lastRemoved !== null && (
        <div className="undo" role="status">
          <span className="undo__text">「{todo.lastRemoved.title}」を削除しました</span>
          <button type="button" onClick={todo.undoRemove}>
            元に戻す
          </button>
        </div>
      )}
    </div>
  )
}
