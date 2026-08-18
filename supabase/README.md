# サーバー側の定義

**ここが正本です。** 以前はスキーマも Edge Function も cron も本番の Supabase の中にしか無く、
「いま何がどうなっているか」を人が読める場所がありませんでした。
失われたら戻せない状態だったので、すべて書き出してあります。

| ファイル | 中身 |
|---|---|
| `schema.sql` | テーブル・RLS・関数・cron の現行定義（上から順に流せば再構築できる） |
| `functions/todo-send-reminders/index.ts` | 期限の通知を送る Edge Function |

## 注意

- **quiz アプリと同じプロジェクトに相乗り**しています。todo 用のものはすべて `todo_` で始まります。
  ここに無いテーブル（`profiles` `attempts` など）は quiz のもので、触りません。
- 秘密（VAPID の秘密鍵、cron の合言葉）は `todo_config` テーブルに入っており、
  **このリポジトリには含めません**。`schema.sql` にも値は書いていません。
- `todo_config` は RLS 有効・ポリシー無しにしてあります。つまり anon / authenticated からは
  1 行も読めず、service_role（Edge Function）だけが読めます。

## 変更したとき

Supabase 側を変えたら、必ず `schema.sql` も更新してください。
本番にしか無い定義を作らないことが、この置き場の目的です。
