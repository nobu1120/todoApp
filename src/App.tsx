import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Filter, StatusFilter } from './types'
import {
  countActive,
  filterTodos,
  matchesQuery,
  matchesStatus,
  sortTodos,
} from './lib/todos'
import { cacheCurrentAssets, ensureServiceWorker } from './lib/notify'
import { addDays, todayISO } from './lib/date'
import { SelectionBar } from './components/SelectionBar'
import { DataNotice } from './components/DataNotice'
import { useTodos } from './hooks/useTodos'
import { useToday } from './hooks/useToday'
import { useNotifications } from './hooks/useNotifications'
import { useTheme } from './hooks/useTheme'
import { useSync } from './hooks/useSync'
import { AccountPanel } from './components/AccountPanel'
import { AccountButton } from './components/AccountButton'
import { TodoForm } from './components/TodoForm'
import { FilterBar } from './components/FilterBar'
import { TodoList } from './components/TodoList'
import { Drawer } from './components/Drawer'
import { TaskDetail } from './components/TaskDetail'
import { SettingsPanel } from './components/SettingsPanel'
import { Icon } from './components/Icon'
import { ViewTabs, type ViewMode } from './components/ViewTabs'
import { CalendarView } from './components/CalendarView'
import { currentYearMonth, toYearMonth } from './lib/calendar'
import { useLocalOnlyNotice } from './hooks/useLocalOnlyNotice'
import { parseInput } from './lib/parseInput'
import { sharedTask } from './lib/shared'

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

  const [filter, setFilter] = useState<Filter>({ status: 'all', categoryId: null, query: '' })
  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [openId, setOpenId] = useState<string | null>(null)
  /*
   * 開いているドロワーは 1 枚だけ。独立した真偽値 2 つにしていると
   * 両方 true になりえて、履歴（pushState）が二重に積まれる。
   */
  const [drawer, setDrawer] = useState<'settings' | 'account' | null>(null)
  const settingsOpen = drawer === 'settings'
  const accountOpen = drawer === 'account'
  const setSettingsOpen = (open: boolean) => setDrawer(open ? 'settings' : null)
  const setAccountOpen = (open: boolean) => setDrawer(open ? 'account' : null)
  const [showDone, setShowDone] = useState(false)
  const [view, setView] = useState<ViewMode>('list')
  const today = useToday()

  // カレンダーで見ている日と月。初期値は今日。
  const [selectedDate, setSelectedDate] = useState(today)
  const [month, setMonth] = useState(() => currentYearMonth())

  const selectDate = useCallback((date: string) => {
    setSelectedDate(date)
    // 前後の月のマスを押したら、その月へ送る。
    setMonth(toYearMonth(date))
  }, [])

  // 選んだテーマと明暗を <html> に反映する。'auto' はここで light / dark に畳まれる。
  const resolvedAppearance = useTheme(settings.theme, settings.appearance)

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

  const visible = useMemo(
    () => sortTodos(filterTodos(todos, filter, today), settings.sortMode),
    [todos, filter, today, settings.sortMode],
  )

  // 「完了」フィルタを選んでいるときは、下の完了セクションと二重になるので分けない。
  const showingDoneFilter = filter.status === 'done'
  const active = showingDoneFilter ? visible : visible.filter((t) => !t.done)
  const done = showingDoneFilter ? [] : visible.filter((t) => t.done)

  const counts = useMemo(() => {
    // 検索中も件数と一覧を一致させる。片方だけ絞ると「すべて 12 / 表示 1 件」になる。
    const inCategory = todos.filter(
      (t) =>
        (filter.categoryId === null || t.categoryId === filter.categoryId) &&
        matchesQuery(t, filter.query),
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
  }, [todos, filter.categoryId, filter.query, today])

  const categoryCounts = useMemo(() => {
    const result: Record<string, number> = {}
    for (const t of todos) {
      if (t.categoryId === null) continue
      if (!matchesStatus(t, filter.status, today)) continue
      if (!matchesQuery(t, filter.query)) continue
      result[t.categoryId] = (result[t.categoryId] ?? 0) + 1
    }
    return result
  }, [todos, filter.status, filter.query, today])

  const categoryUsage = useMemo(() => {
    const result: Record<string, number> = {}
    for (const t of todos) {
      if (t.categoryId === null) continue
      result[t.categoryId] = (result[t.categoryId] ?? 0) + 1
    }
    return result
  }, [todos])

  const openTodo = openId === null ? null : (todos.find((t) => t.id === openId) ?? null)

  /**
   * Service Worker を起動時に登録する。通知を使わない人でも、
   * これが無いとオフラインで開けない。
   */
  useEffect(() => {
    void ensureServiceWorker().then(() => {
      // 読み込みが落ち着いてから、その資産をキャッシュしてもらう。
      // これが無いと、初回訪問では何も貯まらず圏外で開けない。
      setTimeout(() => void cacheCurrentAssets(), 1500)
    })
  }, [])

  /**
   * 通知の「完了」から戻ってきたぶんを片付ける。
   * 開いているタブがあれば postMessage、無ければ URL に載って起動する。
   */
  // listener からは常に最新のストアを見る。空の依存配列に閉じ込めると、
  // 開いた後に追加・同期されたタスクを見つけられない。
  const todoRef = useRef(todo)
  // レンダー中に書き換えるとレンダーが純粋でなくなるので effect で合わせる。
  useEffect(() => {
    todoRef.current = todo
  })

  useEffect(() => {
    const done = (id: string) => {
      const target = todoRef.current.store.todos.find((t) => t.id === id)
      if (target !== undefined && !target.done) todoRef.current.toggle(id)
    }

    const params = new URLSearchParams(window.location.search)
    const fromUrl = params.get('done')
    if (fromUrl !== null) done(fromUrl)

    /*
     * 他のアプリの共有シートから来たぶん。
     * 確認を挟まずその場で足す（挟むと 1 タップにならない）。
     * 取り消しのトーストが出るので、間違って共有しても戻せる。
     */
    const shared = sharedTask(params)
    if (shared !== null) {
      const parsed = parseInput(shared.title, todayISO(), todoRef.current.store.categories)
      const id = todoRef.current.add({
        title: parsed.title,
        dueDate: parsed.dueDate,
        dueTime: parsed.dueTime,
        categoryId: parsed.categoryId,
        priority: parsed.priority,
        repeat: parsed.repeat,
        notes: shared.notes,
      })
      setJustShared({ id, title: parsed.title })
    }

    // 再読み込みで二重に効かないよう、URL からは消す。
    if (fromUrl !== null || shared !== null || params.has('add')) {
      for (const key of ['done', 'title', 'text', 'url', 'add']) params.delete(key)
      const rest = params.toString()
      window.history.replaceState(null, '', window.location.pathname + (rest === '' ? '' : `?${rest}`))
    }

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'todo:done' && typeof event.data.id === 'string') done(event.data.id)
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage)
  }, [])

  /*
   * 選択は「いま見えているもの」に必ず閉じ込める。
   * 絞り込み・検索・同期で一覧が変わっても選択が残っていたため、
   * 「1 件だけ表示している状態で削除を押したら 3 件消えた」が起きていた。
   */
  const visibleIds = useMemo(() => new Set(active.map((t) => t.id)), [active])
  const selectedList = useMemo(
    () => [...selectedIds].filter((id) => visibleIds.has(id)),
    [selectedIds, visibleIds],
  )

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const leaveSelecting = useCallback(() => {
    setSelecting(false)
    setSelectedIds(new Set())
  }, [])

  /* 共有シートから足したぶん。黙って増えると気づけないので、その場で取り消せるようにする。 */
  const [justShared, setJustShared] = useState<{ id: string; title: string } | null>(null)
  useEffect(() => {
    if (justShared === null) return
    const timer = setTimeout(() => setJustShared(null), 6000)
    return () => clearTimeout(timer)
  }, [justShared])

  const localOnly = useLocalOnlyNotice(todos.length)

  const remaining = countActive(todos)

  return (
    <div className={`app${view === 'calendar' ? ' app--calendar' : ''}`}>
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
        <div className="app__actions">
          <AccountButton
            email={sync.email}
            status={sync.status}
            onClick={() => setAccountOpen(true)}
          />
          <button
            type="button"
            className="icon-button icon-button--lg"
            onClick={() => setSettingsOpen(true)}
            aria-label="設定"
          >
            <Icon name="settings" />
          </button>
        </div>
      </header>

      <ViewTabs view={view} onChange={setView} />

      {view === 'calendar' ? (
        <div role="tabpanel" id="view-panel-calendar" aria-labelledby="view-tab-calendar">
        <CalendarView
          todos={todos}
          categories={categories}
          today={today}
          month={month}
          selected={selectedDate}
          onChangeMonth={setMonth}
          onSelect={selectDate}
          onAdd={todo.add}
          onToggle={todo.toggle}
          onOpen={setOpenId}
          onRemove={todo.remove}
        />
        </div>
      ) : (
      <div role="tabpanel" id="view-panel-list" aria-labelledby="view-tab-list">
      <DataNotice
        syncError={sync.status === 'error' ? sync.error : null}
        signedIn={sync.session !== null}
        authPending={sync.authPending}
        count={todos.length}
        onOpenAccount={() => setAccountOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onDismiss={localOnly.dismiss}
        showLocalOnly={localOnly.show}
      />


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
        sortMode={settings.sortMode}
        selecting={selecting}
        onChange={setFilter}
        onChangeSort={(sortMode) => todo.updateSettings({ sortMode })}
        onToggleSelecting={() => (selecting ? leaveSelecting() : setSelecting(true))}
      />

      {active.length === 0 && done.length === 0 ? (
        <div className="empty">
          <p className="empty__art" aria-hidden="true">
            {EMPTY_MESSAGE[filter.status].art}
          </p>
          <p className="empty__title">{EMPTY_MESSAGE[filter.status].title}</p>
          {todos.length === 0 && (
            <p className="empty__hint">上の欄に入力して ＋ を押すと追加できます。</p>
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
          selecting={selecting}
          selectedIds={selectedIds}
          onToggle={todo.toggle}
          onOpen={setOpenId}
          onRemove={todo.remove}
          onSelect={toggleSelected}
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

      </div>
      )}

      <Drawer
        open={openTodo !== null}
        title={openTodo?.title.trim() || 'タスクの詳細'}
        onClose={() => setOpenId(null)}
      >
        {openTodo !== null && (
          <TaskDetail
            todo={openTodo}
            categories={categories}
            onUpdate={(patch) => todo.update(openTodo.id, patch)}
            onAddSubtask={(title) => todo.addSubtask(openTodo.id, title)}
            onToggleSubtask={(sid) => todo.toggleSubtask(openTodo.id, sid)}
            onRenameSubtask={(sid, title) => todo.renameSubtask(openTodo.id, sid, title)}
            onRemoveSubtask={(sid) => todo.removeSubtask(openTodo.id, sid)}
            onToggle={() => todo.toggle(openTodo.id)}
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
          resolvedAppearance={resolvedAppearance}
          store={store}
          onImport={todo.importStore}
          signedIn={sync.session !== null}
          pushReady={sync.pushReady}
          onUpdateSettings={todo.updateSettings}
          onEnableNotifications={enable}
          onRegisterPush={sync.registerPush}
          onAddCategory={todo.addCategory}
          onUpdateCategory={todo.updateCategory}
          onRemoveCategory={todo.removeCategory}
        />
      </Drawer>

      <Drawer open={accountOpen} title="アカウント" onClose={() => setAccountOpen(false)}>
        <AccountPanel
          email={sync.email}
          status={sync.status}
          error={sync.error}
          lastSyncedAt={sync.lastSyncedAt}
          pushReady={sync.pushReady}
          onSignIn={sync.signIn}
          onSignInWithLink={sync.signInWithLink}
          onSignOut={sync.signOut}
          onSync={sync.fullSync}
        />
      </Drawer>

      {selecting && (
        <SelectionBar
          count={selectedList.length}
          total={active.length}
          onSelectAll={() => setSelectedIds(new Set(active.map((t) => t.id)))}
          onClear={() => setSelectedIds(new Set())}
          onDone={() => {
            todo.bulkToggle(selectedList, true)
            leaveSelecting()
          }}
          onDueToday={() => {
            todo.bulkDue(selectedList, today)
            leaveSelecting()
          }}
          onDueTomorrow={() => {
            todo.bulkDue(selectedList, addDays(today, 1))
            leaveSelecting()
          }}
          onRemove={() => {
            todo.bulkRemove(selectedList)
            leaveSelecting()
          }}
        />
      )}

      {justShared !== null && (
        <div className="undo" role="status">
          <span className="undo__text">「{justShared.title}」を追加しました</span>
          <button
            type="button"
            onClick={() => {
              todo.remove(justShared.id)
              setJustShared(null)
            }}
          >
            取り消す
          </button>
        </div>
      )}

      {justShared === null && todo.lastRemoved !== null && (
        <div className="undo" role="status">
          <span className="undo__text">
            {todo.lastRemoved.length === 1
              ? `「${todo.lastRemoved[0].title}」を削除しました`
              : `${todo.lastRemoved.length} 件を削除しました`}
          </span>
          <button type="button" onClick={todo.undoRemove}>
            元に戻す
          </button>
        </div>
      )}
    </div>
  )
}
