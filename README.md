# Todo

自分ひとりで使うための、シンプルな Todo アプリ。

- ブラウザだけで動く（サーバー・ログイン不要）
- データはそのブラウザの localStorage に保存される
- 期限つきのタスク管理と、今日 / 期限切れでの絞り込み

詳しい仕様は [`docs/spec.md`](docs/spec.md) を参照。

## 使い方

| 操作 | やり方 |
|---|---|
| 追加 | 上の入力欄に書いて Enter（期限は任意） |
| 完了 | 左のチェックボックス |
| 編集 | タイトルをクリック → Enter で保存 / Esc で取消 |
| 削除 | 右の × （6 秒以内なら「元に戻す」で復活） |
| 絞り込み | すべて / 未完了 / 今日 / 期限切れ / 完了 |

並び順は「未完了が先 → 期限が近い順（期限なしは末尾） → 作成が新しい順」で固定。

## 開発

```bash
npm install
npm run dev      # 開発サーバー (http://localhost:5173/todoApp/)
npm test         # テスト
npm run build    # 本番ビルド → dist/
npm run preview  # 本番ビルドの確認 (http://localhost:4173/todoApp/)
```

`vite.config.ts` の `base` を GitHub Pages に合わせているため、dev / preview でも
ルート `/` ではなく `/todoApp/` を開く。

## 公開（GitHub Pages）

公開先は `https://nobu1120.github.io/todoApp/`。
リポジトリ名を変える場合は `vite.config.ts` の `base` も合わせて変更すること。

### 準備済みのもの

- **`gh-pages` ブランチ** — `npm run build` の出力を配置済み。Pages を有効にすればそのまま配信される。
  `.nojekyll` 入りで、GitHub Pages と同じパス構造（`/todoApp/`）での動作を確認済み。
- **`main` ブランチ** — 作成済み。

### 残りの手順

以下は**リポジトリの設定**で、API から変更する手段が無いためオーナーが操作する必要がある。
どちらも**スマホのブラウザ（github.com）だけで完結する**。

**1. リポジトリを public にする（Free プランの場合）**

GitHub Pages を **private リポジトリから公開するには GitHub Pro 以上**が必要。
Free プランなら Settings → General → Danger Zone → Change visibility → Public。

> 公開して困るものは無い。タスクは端末のブラウザ内（localStorage）にしか保存されず、
> リポジトリにもサーバーにも一切送られないため、ページを見られてもタスクの中身は漏れない。
> 逆に、別の端末やブラウザからは別のデータになる（同期はしない）。

Pro を使っている場合はこの手順は不要。

**2. Pages を有効にする**

Settings → Pages → Build and deployment で

- Source: **Deploy from a branch**
- Branch: **`gh-pages`** / **`/ (root)`**

を選んで Save。数十秒で `https://nobu1120.github.io/todoApp/` が開くようになる。

### サイトを更新するとき

`gh-pages` はビルド成果物なので、ソースを変えたら作り直して push する。

```bash
npm run build
touch dist/.nojekyll

git worktree add /tmp/ghp gh-pages
rm -rf /tmp/ghp/assets /tmp/ghp/index.html
cp -r dist/. /tmp/ghp/
git -C /tmp/ghp add -A
git -C /tmp/ghp commit -m "サイトを更新"
git -C /tmp/ghp push
git worktree remove /tmp/ghp
```

自動化してしまうほうが結局は楽なので、頻繁に更新するようになったら次節を検討する。

### 自動デプロイにしたい場合（任意）

毎回手でビルドするのが面倒になったら、GitHub Actions に切り替えられる。
ワークフローは [`docs/github-pages-deploy.yml`](docs/github-pages-deploy.yml) に用意してある
（Claude のトークンに `workflow` スコープが無く、`.github/workflows/` へは push も API 経由の作成もできなかったため、ここに置いてある）。

1. `docs/github-pages-deploy.yml` を開く → ✏️ Edit → **ファイル名の欄**を
   `.github/workflows/deploy.yml` に書き換える → Commit
   （スマホならコピペ不要のこの方法が早い。※ GitHub の**モバイルアプリでは不可**、ブラウザで開くこと）
2. Settings → General → Default branch を **`main`** に変更
3. Settings → Pages → Source を **GitHub Actions** に変更

以降は `main` に push するたび、テスト → ビルド → デプロイが自動で走る。

以降は `main` に push するたび、テスト → ビルド → デプロイが自動で走る。
Actions タブから手動実行（Run workflow）もできる。

## 構成

```
src/
├─ types.ts              型定義
├─ lib/
│  ├─ date.ts            ローカル日付ユーティリティ
│  ├─ todos.ts           reducer と絞り込み・並び替え（純粋関数）
│  ├─ storage.ts         localStorage への読み書きとデータ検証
│  └─ todos.test.ts      テスト
├─ hooks/
│  ├─ useTodos.ts        状態管理と自動保存、削除の取り消し
│  └─ useToday.ts        「今日」の日付（日付またぎに追従）
└─ components/           TodoForm / FilterBar / TodoList / TodoItem
```

ロジックは `lib/` の純粋関数に寄せ、localStorage に触るのは `lib/storage.ts` だけにしている。
