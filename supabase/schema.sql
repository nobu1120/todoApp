-- =============================================================================
-- Todo アプリのサーバー側定義（現行）
--
-- quiz アプリと同じ Supabase プロジェクトに相乗りしているため、
-- todo 用のものはすべて todo_ で始める。ここに無いものは quiz のもの。
--
-- 秘密（VAPID の秘密鍵、cron の合言葉）は todo_config に入れる。
-- 値はこのファイルには書かない。
-- =============================================================================

-- --- テーブル ----------------------------------------------------------------

/*
 * id は text。uuid にしない。
 * アプリ側の id は不透明な文字列で、初期カテゴリは 'cat-work' のような
 * 固定文字列を使う。uuid 列にしていたため書き込みが毎回 22P02 で 400 になり、
 * 同期が一度も成功しない状態が続いた。
 *
 * 主キーは (user_id, id)。id 単独にすると、全員共通の固定 id を持つ
 * 初期カテゴリで衝突し、2 人目以降が永久に同期できない。
 */
create table if not exists public.todo_items (
  id            text not null,
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null default '',
  done          boolean not null default false,
  due_date      date,
  due_time      time,
  icon          text not null default '',
  category_id   text,
  notes         text not null default '',
  subtasks      jsonb not null default '[]'::jsonb,
  priority      text not null default 'normal',
  repeat        text not null default 'none',
  spawned_from  text,
  notified_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  completed_at  timestamptz,
  deleted_at    timestamptz,
  primary key (user_id, id),
  constraint todo_items_priority_check check (priority in ('high', 'normal', 'low')),
  constraint todo_items_repeat_check check (repeat in ('none', 'daily', 'weekly', 'monthly'))
);

create table if not exists public.todo_categories (
  id          text not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default '',
  color       text not null default 'gray',
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (user_id, id),
  constraint todo_categories_color_check
    check (color in ('blue','green','orange','purple','red','teal','pink','gray'))
);

create table if not exists public.todo_settings (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  notifications_enabled boolean not null default false,
  default_notify_time  time not null default '09:00',
  -- 最後に同期した端末の時間帯。期限を「その土地の時刻」で解釈するのに使う。
  time_zone            text not null default 'Asia/Tokyo',
  theme                text not null default 'fluoro',
  sort_mode            text not null default 'due',
  archive_after_days   integer not null default 0,
  updated_at           timestamptz not null default now(),
  constraint todo_settings_sort_mode_check check (sort_mode in ('due', 'priority')),
  constraint todo_settings_archive_check check (archive_after_days in (0, 30, 90, 365))
);

create table if not exists public.todo_push_subscriptions (
  endpoint  text primary key,
  user_id   uuid not null references auth.users(id) on delete cascade,
  p256dh    text not null,
  auth      text not null,
  created_at timestamptz not null default now()
);

-- 秘密の置き場。RLS を有効にしてポリシーを 1 つも作らないことで、
-- anon / authenticated からは 1 行も読めず、service_role だけが読める。
create table if not exists public.todo_config (
  key   text primary key,
  value text not null
);

-- --- RLS ---------------------------------------------------------------------

alter table public.todo_items enable row level security;
alter table public.todo_categories enable row level security;
alter table public.todo_settings enable row level security;
alter table public.todo_push_subscriptions enable row level security;
alter table public.todo_config enable row level security;  -- ポリシーは作らない

create policy todo_items_own on public.todo_items
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy todo_categories_own on public.todo_categories
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy todo_settings_own on public.todo_settings
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy todo_push_own on public.todo_push_subscriptions
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- Realtime ----------------------------------------------------------------

/*
 * publication に入れないと、購読しても永久にイベントが来ない。
 * WebSocket の接続自体は成功するので、画面上は正常に見えてしまう。
 */
alter publication supabase_realtime add table public.todo_items;
alter publication supabase_realtime add table public.todo_categories;

-- --- 関数 --------------------------------------------------------------------

/*
 * 通知すべきタスクを返す。
 *
 * SECURITY DEFINER で、利用者による絞り込みを持たない。
 * したがって anon / authenticated に EXECUTE を渡してはいけない
 * （渡していたため、公開している anon キーだけで全員のタスク名が読めた）。
 * 呼ぶのは Edge Function（service_role）だけ。
 */
create or replace function public.todo_due_reminders()
returns table(
  item_id text, user_id uuid, title text, icon text, due_date date, due_time time
)
language sql
security definer
set search_path to 'public'
as $$
  select
    i.id, i.user_id, i.title, i.icon, i.due_date,
    coalesce(i.due_time, s.default_notify_time)
  from public.todo_items i
  join public.todo_settings s on s.user_id = i.user_id
  where i.deleted_at is null
    and i.done = false
    and i.notified_at is null
    and i.due_date is not null
    and s.notifications_enabled
    and ((i.due_date + coalesce(i.due_time, s.default_notify_time)) at time zone s.time_zone) <= now()
    and now() - ((i.due_date + coalesce(i.due_time, s.default_notify_time)) at time zone s.time_zone)
        < interval '24 hours';
$$;

revoke execute on function public.todo_due_reminders() from public, anon, authenticated;

-- 新しく作る関数が PUBLIC に実行権限を持たないようにする。
alter default privileges in schema public revoke execute on functions from public;

/** cron から Edge Function を叩く。合言葉は todo_config から読む。 */
create or replace function public.todo_trigger_reminders()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  secret text;
begin
  select value into secret from public.todo_config where key = 'cron_secret';
  if secret is null then
    raise warning 'todo_trigger_reminders: cron_secret が未設定のため送信を見送りました';
    return;
  end if;

  perform net.http_post(
    url := 'https://roofopskzyfpttnsyuwu.supabase.co/functions/v1/todo-send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

/*
 * 論理削除した行の掃除。
 * deleted_at を立てた行は放っておくと永久に残り、同期のたびに全件を返す。
 * 墓標の有効期間（30 日）より十分に長く置いてから消す。
 */
create or replace function public.todo_purge_deleted()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  removed integer;
begin
  delete from public.todo_items
  where deleted_at is not null and deleted_at < now() - interval '90 days';
  get diagnostics removed = row_count;

  delete from public.todo_categories
  where deleted_at is not null and deleted_at < now() - interval '90 days';

  return removed;
end;
$$;

revoke execute on function public.todo_purge_deleted() from public, anon, authenticated;

-- --- cron --------------------------------------------------------------------

-- select cron.schedule('todo-send-reminders', '* * * * *', 'select public.todo_trigger_reminders();');
-- select cron.schedule('todo-purge-deleted',  '17 4 * * *', 'select public.todo_purge_deleted();');

-- --- 健全性の確認 ------------------------------------------------------------

/*
 * この環境からはブラウザ ↔ Supabase の往復を試せないため、
 * 「静かに壊れていないか」は SQL で見る。定期的に流すこと。
 *
 *   select
 *     (select count(*) from public.todo_items
 *        where updated_at > now() - interval '24 hours') as writes_24h,
 *     (select count(*) from cron.job_run_details
 *        where status <> 'succeeded' and start_time > now() - interval '24 hours') as cron_failures,
 *     (select count(*) from net._http_response
 *        where status_code <> 200 and created > now() - interval '6 hours') as push_failures,
 *     (select count(*) from pg_publication_tables
 *        where pubname = 'supabase_realtime' and tablename like 'todo%') as realtime_tables;
 *
 * writes_24h が 0 のまま、あるいは realtime_tables が 2 未満なら、何かが黙って壊れている。
 * 4xx はログでも見られる（source='edge_logs'、response.status_code >= 400）。
 */
