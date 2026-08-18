import type { Category, CategoryColor } from '../types'
import { newId } from './todos'

/** 選べる色。実際の色値は index.css の --cat-<key> / --cat-<key>-soft。 */
export const CATEGORY_COLORS: { key: CategoryColor; label: string }[] = [
  { key: 'blue', label: 'ブルー' },
  { key: 'green', label: 'グリーン' },
  { key: 'orange', label: 'オレンジ' },
  { key: 'purple', label: 'パープル' },
  { key: 'red', label: 'レッド' },
  { key: 'teal', label: 'ティール' },
  { key: 'pink', label: 'ピンク' },
  { key: 'gray', label: 'グレー' },
]

export const COLOR_KEYS = CATEGORY_COLORS.map((c) => c.key)

/**
 * 初期カテゴリ。id は固定文字列にして、既定値の生成を決定的にする。
 * updatedAt は最古にしておく。まだ誰も触っていないので、
 * 同期時はサーバー側の値に譲る。
 */
const EPOCH = new Date(0).toISOString()

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-work', name: '仕事', color: 'blue', updatedAt: EPOCH },
  { id: 'cat-private', name: '私用', color: 'green', updatedAt: EPOCH },
  { id: 'cat-home', name: '家事', color: 'orange', updatedAt: EPOCH },
  { id: 'cat-study', name: '学習', color: 'purple', updatedAt: EPOCH },
]

export function createCategory(
  name: string,
  color: CategoryColor,
  id: string = newId(),
  now: string = new Date().toISOString(),
): Category {
  return { id, name: name.trim(), color, updatedAt: now }
}

export function findCategory(categories: Category[], id: string | null): Category | null {
  if (id === null) return null
  return categories.find((c) => c.id === id) ?? null
}
