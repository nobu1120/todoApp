# この repo で作業するときのメモ

## 型検査

`npx tsc --noEmit` は**何も検査しない**。ルートの `tsconfig.json` が
`files: []` ＋ project references なので、対象が空のまま成功してしまう。
必ず `npx tsc -b`（または `npm run build`）を使う。

## テスト

`npm test`。純粋ロジックは `src/lib/*.test.ts`、画面は
`src/components/*.test.tsx`（先頭に `// @vitest-environment jsdom` が要る）。

## 見た目を変えたとき

色は必ず既存のトークン（`--alert-bg` など）から取る。テーマが 10 種あり、
直値を書くとどれかで破綻する。`--danger` のような**存在しない変数名を書いても
CSS は黙って無視する**ので、使う前に定義があるか確かめる。

実機幅（390px）での確認には Playwright を使う。ブラウザは
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`。

## 公開

`gh-pages` ブランチにビルド成果物を置く方式。手順は README の
「サイトを更新するとき」にある。サーバー側（Supabase のマイグレーション・
Edge Function）は Supabase MCP から当てる。

## この環境の制約

`github.io` / `supabase.co` への通信はプロキシに塞がれている。
公開後の動作確認は、GitHub API でブランチの中身を見るか、
Supabase MCP（SQL・ログ）で確かめる。
