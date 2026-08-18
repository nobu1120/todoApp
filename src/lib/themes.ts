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
  /** 暗いところでしか成立しないテーマ。明暗の指定を無視してダークにする。 */
  darkOnly?: boolean
}

/*
 * 名前は「実際にそう見えるか」で決める。
 *   - ミルクラテ は白地＋藤色で、名前が約束するものと違っていたので配色を直した。
 *   - ミッドナイト はライトだとほぼ白で「夜」ではなかったので、ダーク専用にした。
 *   - モノスペース は和文に等幅フォントが無く（iOS には無い）、日本語では
 *     等幅になっていなかった。名乗るのをやめて「モノクローム」に改めた。
 *     数字だけの等幅（tabular-nums）は効いているので、その価値は残る。
 *   - 名前は 3 列のカードで折り返さない長さに揃える。
 */
export const THEMES = [
  { id: 'fluoro', name: '白と蛍光', note: '白地に蛍光1色' },
  { id: 'latte', name: 'ミルクラテ', note: '生成りと珈琲' },
  { id: 'washi', name: '和紙と藍', note: '生成りと藍' },
  { id: 'midnight', name: 'ミッドナイト', note: '夜のミント', darkOnly: true },
  { id: 'note', name: 'ノート', note: '罫線と蛍光ペン' },
  { id: 'mono', name: 'モノクローム', note: '白黒・直線' },
  { id: 'glass', name: 'ガラス', note: '半透明の重なり' },
  { id: 'botanical', name: 'ボタニカル', note: '深緑と明朝' },
  { id: 'seventies', name: 'セブンティーズ', note: '琥珀と丸み' },
  { id: 'type', name: '活字', note: '大きな数字' },
] as const satisfies readonly Theme[]

/** ダーク専用のテーマか。 */
export function isDarkOnly(theme: ThemeId): boolean {
  const found: Theme | undefined = THEMES.find((t) => t.id === theme)
  return found?.darkOnly === true
}

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
  theme?: ThemeId,
): 'light' | 'dark' {
  // ダーク専用のテーマは、明暗の指定より優先する。
  if (theme !== undefined && isDarkOnly(theme)) return 'dark'
  if (appearance === 'light') return 'light'
  if (appearance === 'dark') return 'dark'
  return prefersDark ? 'dark' : 'light'
}
