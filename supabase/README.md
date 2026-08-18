# サーバー側の定義

**ここが正本です。** 以前はスキーマも Edge Function も cron も本番の Supabase の中にしか無く、
「いま何がどうなっているか」を人が読める場所がありませんでした。
失われたら戻せない状態だったので、すべて書き出してあります。

| ファイル | 中身 |
|---|---|
| `schema.sql` | テーブル・RLS・関数・cron の現行定義（上から順に流せば再構築できる） |
| `functions/todo-send-reminders/index.ts` | 期限の通知を送る Edge Function |

## 注意

- **専用プロジェクト**（ref `agusbaypthehohpqaigc` / 名前 `todo`）で動いています。
  以前は quiz アプリのプロジェクトに相乗りしていた名残で、名前はすべて `todo_` で始まります。
- 秘密（VAPID の秘密鍵、cron の合言葉）は `todo_config` テーブルに入っており、
  **このリポジトリには含めません**。`schema.sql` にも値は書いていません。
- `todo_config` は RLS 有効・ポリシー無しにしてあります。つまり anon / authenticated からは
  1 行も読めず、service_role（Edge Function）だけが読めます。

## 変更したとき

Supabase 側を変えたら、必ず `schema.sql` も更新してください。
本番にしか無い定義を作らないことが、この置き場の目的です。

## 移行の記録（quiz → 専用プロジェクト）

Pro プランに移ったのを機に、quiz プロジェクトへの相乗りをやめた。

| | 旧 | 新 |
|---|---|---|
| ref | `roofopskzyfpttnsyuwu`（quiz と同居） | `agusbaypthehohpqaigc` |
| auth のユーザー id | `8631441c-…` | **同じ**（同じ uuid で作り直した） |
| VAPID 鍵 | | **同じ**（端末の通知登録がそのまま生きる） |

`auth.users` を同じ uuid で作り直したので、`user_id` の付け替えは要らなかった。
移送後、両プロジェクトの todo 一式（items / categories / settings /
push_subscriptions / config / auth ユーザー = 13 行）の md5 が一致することを
確認したうえで、quiz 側の `todo_` の表・関数・cron・publication を落とした。
quiz 自身のもの（`profiles` `attempts` `questions` など）と `auth.users` は触っていない。

残っている手作業:

- quiz 側の Edge Function `todo-send-reminders` は API から消せないため、
  410 を返すだけのスタブに差し替えてある。管理画面から削除してよい。
- 新プロジェクトの Authentication → URL Configuration
  （Site URL と Redirect URLs）は管理画面でしか設定できない。README を参照。
