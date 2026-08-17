import type { Category, CategoryColor } from '../types'

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

/** 初期カテゴリ。id は固定文字列にして、既定値の生成を決定的にする。 */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-work', name: '仕事', color: 'blue' },
  { id: 'cat-private', name: '私用', color: 'green' },
  { id: 'cat-home', name: '家事', color: 'orange' },
  { id: 'cat-study', name: '学習', color: 'purple' },
]

export function createCategory(
  name: string,
  color: CategoryColor,
  id: string = crypto.randomUUID(),
): Category {
  return { id, name: name.trim(), color }
}

export function findCategory(categories: Category[], id: string | null): Category | null {
  if (id === null) return null
  return categories.find((c) => c.id === id) ?? null
}
