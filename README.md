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

### 初回だけ必要な手順

**1. ワークフローを配置する**

デプロイ用ワークフローは [`docs/github-pages-deploy.yml`](docs/github-pages-deploy.yml) に置いてある。
Claude が使うトークンに `workflow` スコープがなく `.github/workflows/` を push できないため、
手元で移動してほしい。

```bash
mkdir -p .github/workflows
cp docs/github-pages-deploy.yml .github/workflows/deploy.yml
git add .github/workflows/deploy.yml
git commit -m "GitHub Pages へのデプロイワークフローを追加"
git push
```

**2. Pages を有効にする**

Settings → Pages → Build and deployment → Source を **GitHub Actions** に変更する。

以降は `main` に push するたび、テスト → ビルド → デプロイが自動で走る。

> データは端末のブラウザ内にしか保存されないため、ページを公開しても他人からタスクは見えない。
> 逆に、別の端末やブラウザからは別のデータになる（同期はしない）。

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
