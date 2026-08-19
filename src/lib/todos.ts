import type {
  Category,
  Filter,
  Priority,
  Repeat,
  Settings,
  SortMode,
  StatusFilter,
  Subtask,
  ShoppingItem,
  Todo,
  TodoStore,
  Tombstone,
} from '../types'
import {
  addDays,
  addMonthsToDate,
  diffInDays,
  isOverdue,
  nthWeekdayOfMonth,
  parseISODate,
  todayISO,
  weekdayOrdinal,
} from './date'
import { SHOPPING_MAX, SHOPPING_NAME_MAX, SHOPPING_QTY_MAX, clampMemo } from './storage'

export type NewTodoInput = {
  title: string
  dueDate?: string | null
  dueTime?: string | null
  icon?: string
  categoryId?: string | null
  startDate?: string | null
  order?: number
  priority?: Priority
  repeat?: Repeat
  /** 共有シートから来た参照元 URL など。 */
  notes?: string
}

const PRIORITY_RANK: Record<Todo['priority'], number> = { high: 0, normal: 1, low: 2 }

/**
 * id を作る。crypto.randomUUID は安全なコンテキスト（https / localhost）にしか
 * 無いので、無い環境では時刻と乱数で代替する（1 人用なので衝突は実質起きない）。
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** 編集できるフィールドだけを露出する。id や createdAt は書き換えさせない。 */
export type TodoPatch = Partial<
  Pick<
    Todo,
    | 'title'
    | 'dueDate'
    | 'dueTime'
    | 'icon'
    | 'categoryId'
    | 'notes'
    | 'priority'
    | 'repeat'
    | 'startDate'
  >
>

/**
 * 買い物リストの各行に手を入れる。
 * 中身が 1 つも変わらなければ、更新時刻も進めない
 * （進めると、何も変えていないのに同期が起きる）。
 */
function mapShopping(
  store: TodoStore,
  now: string,
  fn: (item: ShoppingItem) => ShoppingItem,
): TodoStore {
  let changed = false
  const items = store.shopping.items.map((item) => {
    const next = fn(item)
    if (next !== item) changed = true
    return next
  })
  return changed ? { ...store, shopping: { items, updatedAt: now } } : store
}

/** いまの一番上の order。空なら 0。 */
function topOrder(todos: Todo[]): number {
  let min = 0
  for (const todo of todos) if (todo.order < min) min = todo.order
  return min
}

export function createTodo(
  input: NewTodoInput,
  now: string = new Date().toISOString(),
  id: string = newId(),
): Todo {
  return {
    id,
    title: input.title.trim(),
    done: false,
    dueDate: input.dueDate ?? null,
    dueTime: input.dueTime ?? null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    icon: input.icon ?? '',
    categoryId: input.categoryId ?? null,
    notes: input.notes ?? '',
    subtasks: [],
    notifiedAt: null,
    startDate: input.startDate ?? null,
    // 既定は 0。追加時に一覧の先頭へ来るよう、reducer 側で振り直す。
    order: input.order ?? 0,
    priority: input.priority ?? 'normal',
    repeat: input.repeat ?? 'none',
    spawnedFrom: null,
  }
}

/**
 * 繰り返しタスクの次の期限。期限が無ければ繰り返しようがないので null。
 * すでに過ぎている場合は、今日より後になるまで進める
 * （3 日ぶん溜めてから消化しても、次が過去日にならないように）。
 */
/** 土日か。平日繰り返しで飛ばす判定に使う。 */
const isWeekend = (iso: string): boolean => {
  const day = parseISODate(iso).getDay()
  return day === 0 || day === 6
}

export function nextDueDate(
  dueDate: string | null,
  repeat: Repeat,
  today: string = todayISO(),
): string | null {
  if (dueDate === null || repeat === 'none') return null

  /*
   * 毎月は「元の日にち」を基準に数える。
   * 1 回進めた結果から次を数えると、末日の丸めで日にちが後戻りしていく
   * （1/31 → 2/28 → 3/28 → …）。基準は動かさず、回数だけ増やす。
   */
  /*
   * 第N曜日は「日にち」ではなく「その月の第何週の何曜日か」で数える。
   * 元の期限からその位置を読み取り、月だけ進めて同じ位置を取り直す。
   */
  const ordinal = weekdayOrdinal(dueDate)
  const weekday = parseISODate(dueDate).getDay()
  const base = parseISODate(dueDate)

  const step = (n: number): string => {
    switch (repeat) {
      case 'daily':
        return addDays(dueDate, n)
      case 'weekday': {
        // 平日だけ数える。n 営業日ぶん進める。
        let iso = dueDate
        for (let i = 0; i < n; i++) {
          do {
            iso = addDays(iso, 1)
          } while (isWeekend(iso))
        }
        return iso
      }
      case 'weekly':
        return addDays(dueDate, n * 7)
      case 'monthly-weekday': {
        const month = base.getMonth() + n
        return nthWeekdayOfMonth(
          base.getFullYear() + Math.floor(month / 12),
          (((month % 12) + 12) % 12) + 1,
          weekday,
          ordinal,
        )
      }
      default:
        return addMonthsToDate(dueDate, n)
    }
  }

  // 取りこぼしを詰める。長く放置したぶんは飛ばし、必ず今日より後にする。
  const LIMIT = 1200
  let n = 1
  while (n < LIMIT && step(n) <= today) n++
  const next = step(n)
  if (next > today) return next

  // 上限に当たっても過去日は返さない（生成直後に期限切れで並ぶのを避ける）。
  // ただし平日指定なら土日には落とさない。
  let fallback = addDays(today, 1)
  if (repeat === 'weekday') while (isWeekend(fallback)) fallback = addDays(fallback, 1)
  return fallback
}

/** 完了した繰り返しタスクから、次回ぶんを作る。 */
export function repeatOf(todo: Todo, now: string, today: string, id: string): Todo | null {
  const due = nextDueDate(todo.dueDate, todo.repeat, today)
  if (due === null) return null
  return {
    ...todo,
    id,
    done: false,
    dueDate: due,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    notifiedAt: null,
    // どのタスクから作られたかを残す。完了を取り消したときに取り下げるため。
    spawnedFrom: todo.id,
    // サブタスクは同じ内容で作り直す。チェックは戻す。
    subtasks: todo.subtasks.map((s) => ({ ...s, done: false })),
  }
}

export function createSubtask(title: string, id: string = newId()): Subtask {
  return { id, title: title.trim(), done: false }
}

// --- reducer -----------------------------------------------------------------

export type Action =
  /** 新規追加と、削除の取り消し（保存しておいた Todo をそのまま戻す）の両方に使う。 */
  | { type: 'add'; todo: Todo; now: string }
  | { type: 'update'; id: string; patch: TodoPatch; now: string }
  /** nextId / today は繰り返しタスクの次回ぶんを作るときだけ使う。 */
  | { type: 'toggle'; id: string; now: string; nextId?: string; today?: string }
  | { type: 'remove'; id: string; now: string }
  | {
      type: 'bulk:toggle'
      ids: string[]
      done: boolean
      now: string
      /** 繰り返しタスクの次回ぶんに使う id。件数ぶん用意する。 */
      nextIds?: string[]
      today?: string
    }
  | { type: 'bulk:due'; ids: string[]; dueDate: string | null; now: string }
  | { type: 'bulk:remove'; ids: string[]; now: string }
  /** 同期で受け取った内容をそのまま反映する。updatedAt は触らない。 */
  | { type: 'sync:replace'; store: TodoStore }
  /** 通知済みとして記録し、同じタスクで二度鳴らないようにする。 */
  | { type: 'markNotified'; ids: string[]; now: string }
  | { type: 'subtask:add'; id: string; subtask: Subtask; now: string }
  | { type: 'subtask:toggle'; id: string; subtaskId: string; now: string }
  | { type: 'subtask:rename'; id: string; subtaskId: string; title: string; now: string }
  | { type: 'subtask:remove'; id: string; subtaskId: string; now: string }
  | { type: 'category:add'; category: Category }
  | {
      type: 'category:update'
      id: string
      patch: Partial<Omit<Category, 'id' | 'updatedAt'>>
      now: string
    }
  | { type: 'category:remove'; id: string; now: string }
  | {
      type: 'reorder'
      id: string
      /** この id の直前に置く。null なら末尾。 */
      before: string | null
      now: string
    }
  | { type: 'shopping:add'; name: string; id: string; now: string }
  | { type: 'shopping:toggle'; id: string; now: string }
  | { type: 'shopping:quantity'; id: string; delta: number; now: string }
  | { type: 'shopping:remove'; id: string; now: string }
  | { type: 'shopping:clearDone'; now: string }
  | { type: 'memo:update'; text: string; now: string }
  | { type: 'settings:update'; patch: Partial<Settings>; now: string }

/** 指定 id の Todo だけを差し替える。該当しない要素は同一参照のまま残す。 */
function mapTodo(store: TodoStore, id: string, fn: (todo: Todo) => Todo): TodoStore {
  let changed = false
  const todos = store.todos.map((todo) => {
    if (todo.id !== id) return todo
    changed = true
    return fn(todo)
  })
  return changed ? { ...store, todos } : store
}

function mapSubtask(
  store: TodoStore,
  id: string,
  subtaskId: string,
  now: string,
  fn: (subtask: Subtask) => Subtask,
): TodoStore {
  return mapTodo(store, id, (todo) => ({
    ...todo,
    subtasks: todo.subtasks.map((s) => (s.id === subtaskId ? fn(s) : s)),
    updatedAt: now,
  }))
}

/** 墓標を積む。同じ id のものは最新で置き換える。 */
function withTombstone(store: TodoStore, tombstone: Tombstone): Tombstone[] {
  return [...store.tombstones.filter((t) => t.id !== tombstone.id), tombstone]
}

export function storeReducer(store: TodoStore, action: Action): TodoStore {
  switch (action.type) {
    case 'sync:replace':
      /*
       * 同期の結果は「丸ごと差し替え」にしない。
       * 通信の往復（数百 ms〜数秒）の間に触ったぶんが、
       * 差し替えで消えてローカルからもサーバーからも失われていた。
       * ここでもう一度、更新が新しいほうを採り直す。
       */
      return mergeIncoming(store, action.store)

    case 'add':
      return {
        ...store,
        /*
         * 更新時刻を今にする。元の値のままだと push の対象（updatedAt > 水位）に
         * 入らず、サーバーには消えたままの記録が残る。次の同期で
         * 「サーバーのほうが新しい削除」と判定され、戻したはずのものが
         * もう一度消える。
         *
         * order は「いまの一番上より小さい値」にする。手で並べているときに
         * 末尾へ足すと、追加したものが画面の外に出て見えない。
         */
        todos: [
          ...store.todos,
          { ...action.todo, updatedAt: action.now, order: topOrder(store.todos) - 1 },
        ],
        // 復活させたのだから、消した記録は取り下げる。
        tombstones: store.tombstones.filter((t) => t.id !== action.todo.id),
      }

    case 'update':
      return mapTodo(store, action.id, (todo) => {
        const patch = { ...action.patch }
        if (patch.title !== undefined) patch.title = patch.title.trim()
        const next = { ...todo, ...patch, updatedAt: action.now }
        // 期限を動かしたら通知はやり直す。
        if (patch.dueDate !== undefined || patch.dueTime !== undefined) next.notifiedAt = null
        /*
         * 着手日は期限を超えさせない。
         * 逆転すると、期限が来るまで一覧から隠れたまま、
         * 過ぎた瞬間に期限切れとして現れる（＝間に合わなくなってから出てくる）。
         * どちらを動かしても、着手日のほうを引き戻して辻褄を合わせる。
         */
        if (next.dueDate !== null && next.startDate !== null && next.startDate > next.dueDate) {
          next.startDate = next.dueDate
        }
        return next
      })

    case 'toggle': {
      const target = store.todos.find((todo) => todo.id === action.id)
      const toggled = mapTodo(store, action.id, (todo) => {
        const done = !todo.done
        return {
          ...todo,
          done,
          completedAt: done ? action.now : null,
          updatedAt: action.now,
        }
      })
      if (target === undefined) return toggled

      if (target.done) {
        /*
         * 完了を取り消した。押し間違いなので、このタスクから作られた次回ぶんも
         * 取り下げる。ただし、その後に手を入れたもの（編集・完了）は残す。
         */
        const undo = toggled.todos.filter(
          (t) => t.spawnedFrom === action.id && !t.done && t.updatedAt === t.createdAt,
        )
        if (undo.length === 0) return toggled
        const ids = new Set(undo.map((t) => t.id))
        return { ...toggled, todos: toggled.todos.filter((t) => !ids.has(t.id)) }
      }

      // 繰り返しタスクを完了にしたら、次回ぶんをその場で作る。
      if (action.nextId === undefined) return toggled
      const next = repeatOf(target, action.now, action.today ?? action.now.slice(0, 10), action.nextId)
      return next === null ? toggled : { ...toggled, todos: [...toggled.todos, next] }
    }

    case 'bulk:toggle': {
      const ids = new Set(action.ids)
      // 個別の完了と揃える。ここだけ次回を作らないと、まとめて片付けた
      // 繰り返しタスクが静かに止まってしまう。
      const spawned: Todo[] = []
      const todos = store.todos.map((todo) => {
        if (!ids.has(todo.id) || todo.done === action.done) return todo
        if (action.done && action.nextIds !== undefined) {
          const nextId = action.nextIds[spawned.length] ?? action.nextIds[0]
          const next =
            nextId === undefined
              ? null
              : repeatOf(todo, action.now, action.today ?? action.now.slice(0, 10), nextId)
          if (next !== null) spawned.push(next)
        }
        return {
          ...todo,
          done: action.done,
          completedAt: action.done ? action.now : null,
          updatedAt: action.now,
        }
      })
      return { ...store, todos: [...todos, ...spawned] }
    }

    case 'bulk:due': {
      const ids = new Set(action.ids)
      return {
        ...store,
        todos: store.todos.map((todo) =>
          ids.has(todo.id)
            ? {
                ...todo,
                dueDate: action.dueDate,
                // 期限を外したら時刻も外す（時刻だけ残っても意味がない）。
                dueTime: action.dueDate === null ? null : todo.dueTime,
                notifiedAt: null,
                updatedAt: action.now,
              }
            : todo,
        ),
      }
    }

    case 'bulk:remove': {
      const ids = new Set(action.ids)
      if (ids.size === 0) return store
      return {
        ...store,
        todos: store.todos.filter((todo) => !ids.has(todo.id)),
        tombstones: [
          ...store.tombstones.filter((t) => !ids.has(t.id)),
          ...[...ids].map((id) => ({ id, kind: 'todo' as const, deletedAt: action.now })),
        ],
      }
    }

    case 'remove':
      if (!store.todos.some((todo) => todo.id === action.id)) return store
      return {
        ...store,
        todos: store.todos.filter((todo) => todo.id !== action.id),
        tombstones: withTombstone(store, {
          id: action.id,
          kind: 'todo',
          deletedAt: action.now,
        }),
      }

    case 'markNotified': {
      const ids = new Set(action.ids)
      if (ids.size === 0) return store
      return {
        ...store,
        todos: store.todos.map((todo) =>
          ids.has(todo.id) ? { ...todo, notifiedAt: action.now } : todo,
        ),
      }
    }

    case 'subtask:add':
      return mapTodo(store, action.id, (todo) => ({
        ...todo,
        subtasks: [...todo.subtasks, action.subtask],
        updatedAt: action.now,
      }))

    case 'subtask:toggle':
      return mapSubtask(store, action.id, action.subtaskId, action.now, (s) => ({
        ...s,
        done: !s.done,
      }))

    case 'subtask:rename':
      return mapSubtask(store, action.id, action.subtaskId, action.now, (s) => ({
        ...s,
        title: action.title.trim(),
      }))

    case 'subtask:remove':
      return mapTodo(store, action.id, (todo) => ({
        ...todo,
        subtasks: todo.subtasks.filter((s) => s.id !== action.subtaskId),
        updatedAt: action.now,
      }))

    case 'category:add':
      return { ...store, categories: [...store.categories, action.category] }

    case 'category:update':
      // 更新時刻を進める。これが無いと、改名がサーバーの古い値に巻き戻る。
      return {
        ...store,
        categories: store.categories.map((c) =>
          c.id === action.id ? { ...c, ...action.patch, updatedAt: action.now } : c,
        ),
      }

    case 'category:remove':
      // カテゴリを消したら、参照していたタスクは未分類に落とす（孤児を残さない）。
      return {
        ...store,
        categories: store.categories.filter((c) => c.id !== action.id),
        todos: store.todos.map((todo) =>
          todo.categoryId === action.id
            ? { ...todo, categoryId: null, updatedAt: action.now }
            : todo,
        ),
        tombstones: withTombstone(store, {
          id: action.id,
          kind: 'category',
          deletedAt: action.now,
        }),
      }

    case 'reorder': {
      /*
       * 動かしたタスクの order だけを書き換える。
       * 一覧全体に連番を振り直すと、絞り込みで表に出ていないタスクの
       * 位置まで動いてしまう。両隣の中間を取れば、その 1 件で済む。
       */
      const moving = store.todos.find((t) => t.id === action.id)
      if (moving === undefined || action.before === action.id) return store

      const others = store.todos
        .filter((t) => t.id !== action.id && !t.done)
        .sort((a, b) => a.order - b.order)

      let next: number
      if (action.before === null) {
        // 末尾へ。
        next = others.length === 0 ? 0 : others[others.length - 1].order + 1
      } else {
        const index = others.findIndex((t) => t.id === action.before)
        if (index === -1) return store
        const after = others[index].order
        // 先頭へ落としたら、いまの先頭より小さい値にする。
        next = index === 0 ? after - 1 : (others[index - 1].order + after) / 2
      }

      if (next === moving.order) return store
      return mapTodo(store, action.id, (todo) => ({ ...todo, order: next, updatedAt: action.now }))
    }

    case 'shopping:add': {
      const name = [...action.name.trim()].slice(0, SHOPPING_NAME_MAX).join('')
      // 空は足さない。上限を超えたら黙って捨てず、何も起きない（画面側で報せる）。
      if (name === '' || store.shopping.items.length >= SHOPPING_MAX) return store
      return {
        ...store,
        shopping: {
          // 末尾に足す。書いた順に売り場を回るので、並びを変えない。
          items: [...store.shopping.items, { id: action.id, name, quantity: 1, done: false }],
          updatedAt: action.now,
        },
      }
    }

    case 'shopping:toggle':
      return mapShopping(store, action.now, (item) =>
        item.id === action.id ? { ...item, done: !item.done } : item,
      )

    case 'shopping:quantity':
      return mapShopping(store, action.now, (item) => {
        if (item.id !== action.id) return item
        // 1 より下げない。0 個は「消す」の意味になってしまう。
        const next = Math.min(Math.max(item.quantity + action.delta, 1), SHOPPING_QTY_MAX)
        return next === item.quantity ? item : { ...item, quantity: next }
      })

    case 'shopping:remove': {
      const items = store.shopping.items.filter((i) => i.id !== action.id)
      return items.length === store.shopping.items.length
        ? store
        : { ...store, shopping: { items, updatedAt: action.now } }
    }

    case 'shopping:clearDone': {
      const items = store.shopping.items.filter((i) => !i.done)
      return items.length === store.shopping.items.length
        ? store
        : { ...store, shopping: { items, updatedAt: action.now } }
    }

    case 'memo:update': {
      // 上限はここでも掛ける。画面だけで止めると、同期・取り込み経由で超えられる。
      const text = clampMemo(action.text)
      // 中身が同じなら触らない（updatedAt だけ進めて同期を起こさない）。
      return store.memo.text === text
        ? store
        : { ...store, memo: { text, updatedAt: action.now } }
    }

    case 'settings:update':
      // 更新時刻を必ず進める。同期時に「どちらが新しいか」の判断材料がこれしかない。
      return {
        ...store,
        settings: { ...store.settings, ...action.patch, updatedAt: action.now },
      }
  }
}

/**
 * 同期で受け取った状態を、いまの状態に重ねる。
 * 「往復の間に触ったぶんを取りこぼさない」ためだけの突き合わせなので、
 * 判定は他と同じく更新時刻の新しいほうを採る。
 */
export function mergeIncoming(current: TodoStore, incoming: TodoStore): TodoStore {
  /*
   * 墓標は両側を合流させる。incoming（同期の開始時点のスナップショット）だけを
   * 見ると、往復の最中に消したぶんが丸ごと失われる。
   * 消えたものが画面に戻ってくるうえ、墓標も残らないので
   * サーバーへ削除が伝わることも二度と無くなる。
   */
  const graves = new Map(incoming.tombstones.map((t) => [t.id, t]))
  for (const mine of current.tombstones) {
    const theirs = graves.get(mine.id)
    if (theirs === undefined || mine.deletedAt > theirs.deletedAt) graves.set(mine.id, mine)
  }

  const todos = new Map(incoming.todos.map((t) => [t.id, t]))
  for (const mine of current.todos) {
    const theirs = todos.get(mine.id)
    if (theirs === undefined || mine.updatedAt > theirs.updatedAt) todos.set(mine.id, mine)
  }

  const categories = new Map(incoming.categories.map((c) => [c.id, c]))
  for (const mine of current.categories) {
    const theirs = categories.get(mine.id)
    if (theirs === undefined || mine.updatedAt > theirs.updatedAt) categories.set(mine.id, mine)
  }

  /*
   * 墓標より後に触り直していれば復活、そうでなければ消えたまま。
   * 判定を「id が墓標にあるか」ではなく時刻で行うのが要点で、
   * これがないと「消す → すぐ元に戻す」が同期のたびに巻き戻る。
   */
  for (const [id, grave] of graves) {
    const bucket = grave.kind === 'category' ? categories : todos
    const alive = bucket.get(id)
    if (alive !== undefined && alive.updatedAt > grave.deletedAt) {
      graves.delete(id)
      continue
    }
    bucket.delete(id)
  }

  return {
    ...incoming,
    todos: [...todos.values()],
    categories: [...categories.values()],
    tombstones: [...graves.values()],
    settings:
      current.settings.updatedAt > incoming.settings.updatedAt
        ? current.settings
        : incoming.settings,
  }
}

// --- 進捗 ---------------------------------------------------------------------

export type Progress = { done: number; total: number; ratio: number }

/** サブタスクが 1 つも無ければ null（進捗バーを出さない）。 */
export function progressOf(todo: Todo): Progress | null {
  if (todo.subtasks.length === 0) return null
  const done = todo.subtasks.filter((s) => s.done).length
  return { done, total: todo.subtasks.length, ratio: done / todo.subtasks.length }
}

// --- 通知の判定 ----------------------------------------------------------------

/** 古い期限のタスクが一斉に通知されないよう、通知は期限から 24 時間以内に限る。 */
const NOTIFY_WINDOW_MS = 24 * 60 * 60 * 1000

/** 通知を出すべき時刻。時刻未指定なら設定の既定時刻を使う。 */
export function dueMoment(todo: Todo, settings: Settings): Date | null {
  if (todo.dueDate === null) return null
  return parseISODate(todo.dueDate, todo.dueTime ?? settings.defaultNotifyTime)
}

export function todosToNotify(todos: Todo[], settings: Settings, now: Date): Todo[] {
  return todos.filter((todo) => {
    if (todo.done || todo.notifiedAt !== null) return false
    const moment = dueMoment(todo, settings)
    if (moment === null) return false
    const elapsed = now.getTime() - moment.getTime()
    return elapsed >= 0 && elapsed < NOTIFY_WINDOW_MS
  })
}

// --- 表示用の絞り込み・並び替え ------------------------------------------------

/**
 * まだ出番が来ていないか。着手日が先のものを一覧から外す。
 *
 * ただし**期限を過ぎたものは出す**——着手日より締切のほうが強い。
 * 「まだ始めなくていい」と「もう遅れている」が同時に成り立つときは、
 * 見落とす方が困る。
 */
export function isWaiting(todo: Todo, today: string): boolean {
  // null / undefined のどちらでも「待っていない」扱いにする。
  if (!todo.startDate || todo.startDate <= today) return false
  // 着手日より前でも、期限切れなら隠さない。
  return !isOverdue(todo.dueDate, today)
}

export function matchesStatus(todo: Todo, status: StatusFilter, today: string): boolean {
  switch (status) {
    case 'all':
      // 名前のとおり全部出す。着手日で隠すのは「未完了」「今日」の役目。
      return true
    case 'active':
      return !todo.done && !isWaiting(todo, today)
    case 'today':
      return !todo.done && !isWaiting(todo, today) && todo.dueDate === today
    case 'overdue':
      return !todo.done && isOverdue(todo.dueDate, today)
    case 'done':
      return todo.done
  }
}

/** タイトルとメモの部分一致。大文字小文字とカナの幅は問わない。 */
export function matchesQuery(todo: Todo, query: string): boolean {
  const q = normalizeForSearch(query)
  if (q === '') return true
  return normalizeForSearch(`${todo.title} ${todo.notes}`).includes(q)
}

function normalizeForSearch(value: string): string {
  return value
    .normalize('NFKC') // 全角英数・半角カナの揺れを吸収する
    .toLowerCase()
    .trim()
}

export function filterTodos(todos: Todo[], filter: Filter, today: string = todayISO()): Todo[] {
  return todos.filter(
    (todo) =>
      matchesStatus(todo, filter.status, today) &&
      (filter.categoryId === null || todo.categoryId === filter.categoryId) &&
      matchesQuery(todo, filter.query),
  )
}

/**
 * 完了から一定期間たったタスクを消す対象を挙げる。
 * 実際に消す前に「何件消えるか」を見せるためにも使う。
 */
export function staleTodos(store: TodoStore, now: string): Todo[] {
  const days = store.settings.archiveAfterDays
  if (days <= 0) return []
  const today = now.slice(0, 10)
  return store.todos.filter(
    (t) =>
      t.done &&
      t.completedAt !== null &&
      // 壊れた日時で消してしまわないよう、読めるものだけを対象にする。
      !Number.isNaN(Date.parse(t.completedAt)) &&
      // diffInDays(a, b) は a - b。「今日 - 完了日」が保存期間を超えたら消す。
      diffInDays(today, t.completedAt.slice(0, 10)) >= days,
  )
}

/**
 * 完了から一定期間たったタスクを取り除く。
 * 放っておくと完了タスクが無限に溜まり、同期のたびに全件を往復することになる。
 * 消えたことを他の端末にも伝えるため、墓標を残す。
 *
 * 既定は「消さない」（設定で明示的に選んだときだけ効く）。
 */
export function archiveOld(store: TodoStore, now: string): TodoStore {
  const stale = staleTodos(store, now)
  if (stale.length === 0) return store

  const ids = new Set(stale.map((t) => t.id))
  return {
    ...store,
    todos: store.todos.filter((t) => !ids.has(t.id)),
    // 同じ id の墓標を二重に積まない。
    tombstones: [
      ...store.tombstones.filter((t) => !ids.has(t.id)),
      ...stale.map((t) => ({ id: t.id, kind: 'todo' as const, deletedAt: now })),
    ],
  }
}

/**
 * 未完了が上 → （並び順の指定）→ 作成が新しい順。元配列は変更しない。
 *
 * 'due'      期限が近い順（期限なしは末尾）。同じ日なら優先度の高いほうが上。
 * 'priority' 優先度順。同じ優先度なら期限が近い順。
 */
export function sortTodos(todos: Todo[], mode: SortMode = 'due'): Todo[] {
  const byDue = (a: Todo, b: Todo) => {
    if (a.dueDate === b.dueDate) return 0
    if (a.dueDate === null) return 1
    if (b.dueDate === null) return -1
    return a.dueDate < b.dueDate ? -1 : 1
  }
  const byPriority = (a: Todo, b: Todo) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  const byOrder = (a: Todo, b: Todo) => a.order - b.order

  return [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1

    if (mode === 'manual') {
      const manual = byOrder(a, b)
      if (manual !== 0) return manual
    } else {
      const first = mode === 'priority' ? byPriority(a, b) : byDue(a, b)
      if (first !== 0) return first
      const second = mode === 'priority' ? byDue(a, b) : byPriority(a, b)
      if (second !== 0) return second
    }

    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1
    return 0
  })
}

export function countActive(todos: Todo[]): number {
  return todos.filter((todo) => !todo.done).length
}

/** 画面上部のリマインドに出す、対応が要るタスク。 */
export function needsAttention(
  todos: Todo[],
  today: string = todayISO(),
): { overdue: Todo[]; today: Todo[] } {
  return {
    overdue: sortTodos(todos.filter((t) => !t.done && isOverdue(t.dueDate, today))),
    today: sortTodos(todos.filter((t) => !t.done && t.dueDate === today)),
  }
}
