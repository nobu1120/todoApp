# Todo

自分ひとりで使うための、シンプルな Todo アプリ。

- ブラウザだけで動く。**ログインは任意**で、しなければ端末内だけで完結する
- ログインすると複数端末で同期し、閉じている間も通知が届く
- 期限 / カテゴリ / アイコン / サブタスク進捗 / メモ / 通知

詳しい仕様は [`docs/spec.md`](docs/spec.md) を参照。

## 使い方

| 操作 | やり方 |
|---|---|
| 追加 | 上の入力欄に書いて Enter。下のチップで期限とカテゴリも指定できる |
| 完了 | 左のチェックボックス。完了すると下の折りたたみへ移動 |
| 詳細を開く | タスク名をタップ／クリック |
| アイコン | 詳細画面の左上のボタンから絵文字を選ぶ |
| サブタスク | 詳細画面で追加。チェックした数から進捗が自動計算される |
| メモ | 詳細画面の下部。書くと一覧に印が出る |
| 削除 | 詳細画面の「このタスクを削除」（PC なら行にホバーして ×）。6 秒以内なら取り消せる |
| 絞り込み | 状態（すべて / 未完了 / 今日 / 期限切れ / 完了）とカテゴリの AND |
| 探す | 上の検索欄。タイトルとメモを大文字小文字・全角半角を問わず探す |
| 優先度 | 詳細画面で 高 / 標準 / 低。並び順は「期限順 ⇄ 優先度順」で切り替え |
| 繰り返し | 期限のあるタスクに 毎日 / 毎週 / 毎月。完了にすると次回ぶんが自動で作られる |
| まとめて操作 | 検索欄の右のボタンで選択モード。完了 / 今日 / 明日 / 削除 をまとめて |
| バックアップ | 設定 →「データ」から JSON で書き出し・読み込み |
| カレンダーで見る | 上のタブで「カレンダー」。上半分が月、下半分がその日の予定 |
| 見た目を変える | 右上の歯車 →「見た目」。テーマ 10 種と、自動 / ライト / ダーク |
| 通知・カテゴリ管理 | 右上の歯車 |
| ログイン・ログアウト | 右上のアカウント表示 |

並び順は「未完了が先 → 期限が近い順（期限なしは末尾） → 作成が新しい順」。
「優先度順」に切り替えると、優先度が先で期限が次になる。

**オフラインでも開けます。** 一度開いていれば、圏外や機内モードでもそのまま起動して使えます
（データは元からこの端末の中にあります）。

**完了したタスクは、既定で 90 日たつと自動で消えます。** 設定 →「データ」で
30 日 / 1 年 / 消さない に変えられます。

### 見た目

設定の「見た目」で、配色・書体・角の丸み・行の積み方をまとめて切り替えられる。

白と蛍光 / ミルクラテ / 和紙と藍 / ミッドナイト / ノートとマーカー /
モノスペース / ガラス / ボタニカル / セブンティーズ / タイポグラフィ の 10 種。

明暗はテーマとは別に選ぶ。**既定は「自動」で端末（OS）の設定に従う**ので、
スマホだけ夜に暗くしたいなら自動のままにしておけばよい。
「ライト」「ダーク」を選ぶと、OS の設定より優先される。

ログインしていれば、選んだ**テーマ**は他の端末にも同期される。
**明暗は同期しない**（端末ごとに違っていて自然なため）。

### 通知と同期

通知は右上の歯車、ログインは右上のアカウント表示から設定します。
**今どのアカウントでログインしているかは、ヘッダーに常時出ます**
（狭い画面では頭文字のみ。押すとメールアドレス全体と同期状態が見られます）。

| したいこと | 必要なこと |
|---|---|
| 開いている間だけ通知 | 通知をオンにするだけ（ログイン不要） |
| **閉じている間も通知** | ログイン ＋「この端末で受け取る」 |
| 複数端末で同じリスト | ログイン |

**ログインしなければサーバーとは一切通信しません。** その場合、これまでどおりデータは
この端末のブラウザ内にしか存在しません。ログインすると内容が Supabase に保存され、
別の端末からも同じリストが見られるようになります。

iPhone では、**ホーム画面に追加してそのアイコンから起動**しないと通知が届きません
（iOS の制約）。Android はブラウザのままで動きます。

#### 初回だけ必要な設定

Supabase の管理画面で、ログイン用リンクの戻り先を許可する必要があります。

Authentication → URL Configuration → **Redirect URLs** に
`https://nobu1120.github.io/todoApp/**` を追加してください。

**これをしないとログインが完了しません。** この Supabase プロジェクトは quiz アプリと
同居しており、Site URL が `https://niche-quiz-app.vercel.app` になっています。
戻り先が許可リストに無いと、Supabase はそちらへリダイレクトするため、
リンクを開いても quiz アプリに着地して Todo アプリには戻ってきません
（ログイン自体は成立しているので、エラーは何も出ません）。

#### 設定しないままログインする方法

アカウント画面の「リンクを開いても戻ってこないとき」を開き、
メール内のリンクを**開かずに長押しでコピー**して貼り付けてください。
リダイレクトを経由せず、リンクに含まれるトークンで直接ログインします。
一度開いたリンクは使えないので、その場合は送り直してからコピーします。

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

> 公開するのはアプリのコードだけで、タスクの中身は入っていない。
> リポジトリに置く Supabase の anon キーは公開前提の鍵で、実際の権限は RLS が決めるため、
> 他人がこのページからあなたのタスクを読むことはできない。

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
Actions タブから手動実行（Run workflow）もできる。

## 構成

```
src/
├─ types.ts              型定義
├─ lib/
│  ├─ date.ts            ローカル日付・時刻ユーティリティ
│  ├─ todos.ts           reducer / 絞り込み / 並び替え / 進捗 / 通知判定（純粋関数）
│  ├─ categories.ts      既定カテゴリと色パレット
│  ├─ emoji.ts           アイコン用の絵文字セット
│  ├─ notify.ts          通知と push 購読（Service Worker 経由）
│  ├─ storage.ts         localStorage への読み書き・検証・スキーマ移行
│  ├─ supabase.ts        接続先と公開鍵
│  ├─ sync.ts            サーバーとの突き合わせ（純粋関数）
│  ├─ todos.test.ts      テスト
│  └─ sync.test.ts       同期のテスト
├─ hooks/
│  ├─ useTodos.ts        状態管理と自動保存、削除の取り消し
│  ├─ useToday.ts        「今日」の日付（日付またぎに追従）
│  ├─ useNotifications.ts 許可の管理と期限の定期チェック
│  └─ useSync.ts         ログイン・同期・push 購読（通信するのはここだけ）
└─ components/
   ├─ Icon.tsx           UI 用の SVG アイコン
   ├─ Drawer.tsx         詳細・設定・アカウントの共通パネル
   ├─ TodoForm / FilterBar / TodoList / TodoItem
   ├─ TaskDetail / EmojiPicker / SubtaskList
   ├─ AccountButton / AccountPanel
   └─ ReminderBanner / SettingsPanel
```

ロジックは `lib/` の純粋関数に寄せ、localStorage に触るのは `lib/storage.ts` だけ、
サーバーと通信するのは `hooks/useSync.ts` だけにしている。
UI のアイコンは SVG（`Icon.tsx`）、タスクに付けるアイコンはユーザーが選ぶ絵文字、と役割を分けている。
