/**
 * 見た目の切り替え。
 *
 * 実際の色・書体は index.css の [data-theme='...'] ブロックが持ち、
 * ここは「どの id があるか」「既定は何か」「不正な値をどう落とすか」だけを持つ。
 * こうしておくと、テーマを増やすときに触るのは CSS とこの配列だけで済む。
 */

export type Theme = {
  id: string
  name: string
  /** 一覧で名前の下に出す一言。 */
  note: string
}

export const THEMES = [
  { id: 'fluoro', name: '白と蛍光', note: '白地に蛍光1色' },
  { id: 'latte', name: 'ミルクラテ', note: 'やわらかい丸み' },
  { id: 'washi', name: '和紙と藍', note: '生成りと藍' },
  { id: 'midnight', name: 'ミッドナイト', note: '夜のミント' },
  { id: 'note', name: 'ノートとマーカー', note: '罫線と蛍光ペン' },
  { id: 'mono', name: 'モノスペース', note: '等幅・直線' },
  { id: 'glass', name: 'ガラス', note: '半透明の重なり' },
  { id: 'botanical', name: 'ボタニカル', note: '深緑と明朝' },
  { id: 'seventies', name: 'セブンティーズ', note: '琥珀と丸み' },
  { id: 'type', name: 'タイポグラフィ', note: '大きな数字' },
] as const satisfies readonly Theme[]

/** テーマの一覧が唯一の出どころ。id はそこから導く。 */
export type ThemeId = (typeof THEMES)[number]['id']

export const THEME_IDS: readonly ThemeId[] = THEMES.map((t) => t.id)

/** 'auto' は端末（OS）の設定に従う。 */
export type Appearance = 'auto' | 'light' | 'dark'

export const APPEARANCES: { id: Appearance; label: string }[] = [
  { id: 'auto', label: '自動' },
  { id: 'light', label: 'ライト' },
  { id: 'dark', label: 'ダーク' },
]

export const DEFAULT_THEME: ThemeId = 'fluoro'
export const DEFAULT_APPEARANCE: Appearance = 'auto'

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value)
}

export function isAppearance(value: unknown): value is Appearance {
  return value === 'auto' || value === 'light' || value === 'dark'
}

/**
 * 設定と OS の指定から、実際に適用する明暗を決める。
 * CSS 側は 'light' / 'dark' の二値しか見ないので、'auto' はここで畳む。
 */
export function resolveAppearance(
  appearance: Appearance,
  prefersDark: boolean,
): 'light' | 'dark' {
  if (appearance === 'light') return 'light'
  if (appearance === 'dark') return 'dark'
  return prefersDark ? 'dark' : 'light'
}
