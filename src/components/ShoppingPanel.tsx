import { useState, type FormEvent } from 'react'
import type { Shopping } from '../types'
import { SHOPPING_MAX, SHOPPING_NAME_MAX, SHOPPING_QTY_MAX } from '../lib/storage'
import { Icon } from './Icon'

type Props = {
  shopping: Shopping
  onAdd: (name: string) => void
  onToggle: (id: string) => void
  onQuantity: (id: string, delta: number) => void
  onRemove: (id: string) => void
  onClearDone: () => void
}

/**
 * 買い物リスト。メモと同じく常に 1 つ。
 *
 * その日の買い物のための走り書きなので、名前を付けて複数持つ必要がない。
 * タスクと違って期限も分類も要らず、要るのは「何を・何個・買ったか」だけ。
 *
 * 並びは書いた順のまま変えない。売り場を回る順に書くので、
 * 買ったものを下へ送ると、次に何を取るのか分からなくなる。
 */
export function ShoppingPanel({
  shopping,
  onAdd,
  onToggle,
  onQuantity,
  onRemove,
  onClearDone,
}: Props) {
  const [name, setName] = useState('')
  const items = shopping.items
  const bought = items.filter((i) => i.done).length
  const full = items.length >= SHOPPING_MAX

  function submit(event: FormEvent) {
    event.preventDefault()
    if (name.trim() === '' || full) return
    onAdd(name)
    setName('')
  }

  return (
    <div className="shop">
      <form className="shop__form" onSubmit={submit}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={SHOPPING_NAME_MAX}
          placeholder={full ? 'これ以上は入りません' : '買うものを書く'}
          aria-label="買うもの"
          disabled={full}
        />
        <button type="submit" disabled={name.trim() === '' || full} aria-label="買い物リストに追加">
          <Icon name="plus" />
        </button>
      </form>

      {items.length === 0 ? (
        <p className="shop__empty">
          買うものを書いておくと、店で見ながら消していけます。
        </p>
      ) : (
        <ul className="shop__list">
          {items.map((item) => (
            <li key={item.id} className={`shop__item${item.done ? ' is-done' : ''}`}>
              <label className="shop__check">
                <input type="checkbox" checked={item.done} onChange={() => onToggle(item.id)} />
                <span className="shop__name">{item.name}</span>
              </label>

              <div className="shop__qty" role="group" aria-label={`${item.name} の個数`}>
                <button
                  type="button"
                  onClick={() => onQuantity(item.id, -1)}
                  disabled={item.quantity <= 1}
                  aria-label="1 つ減らす"
                >
                  <Icon name="minus" />
                </button>
                <span aria-label={`${item.quantity} 個`}>{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => onQuantity(item.id, 1)}
                  disabled={item.quantity >= SHOPPING_QTY_MAX}
                  aria-label="1 つ増やす"
                >
                  <Icon name="plus" />
                </button>
              </div>

              <button
                type="button"
                className="icon-button shop__remove"
                onClick={() => onRemove(item.id)}
                aria-label={`${item.name} を消す`}
              >
                <Icon name="close" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="shop__foot">
        <span>
          {items.length} 件{bought > 0 && ` / ${bought} 件かごへ`}
        </span>
        {bought > 0 && (
          <button type="button" className="ghost" onClick={onClearDone}>
            買ったものを消す
          </button>
        )}
      </div>
    </div>
  )
}
