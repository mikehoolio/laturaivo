-- LATURAIVO secure leaderboard hardening
-- Run in Supabase SQL editor as project owner.

-- 1) Moderation table for in-app report button
create table if not exists public.leaderboard_reports (
  id bigint generated always as identity primary key,
  entry_id bigint null,
  player_name text not null,
  score bigint not null default 0,
  reason text not null default 'other',
  details text not null default '',
  created_at timestamptz not null default now()
);

alter table public.leaderboard_reports enable row level security;

drop policy if exists "allow_anon_insert_reports" on public.leaderboard_reports;
create policy "allow_anon_insert_reports"
  on public.leaderboard_reports
  for insert
  to anon, authenticated
  with check (length(player_name) between 2 and 20);

drop policy if exists "owner_read_reports" on public.leaderboard_reports;
create policy "owner_read_reports"
  on public.leaderboard_reports
  for select
  to authenticated
  using (true);

-- 2) Audit table for rate limiting and anti-cheat telemetry
create table if not exists public.leaderboard_submission_audit (
  id bigint generated always as identity primary key,
  session_id text not null,
  nonce text not null,
  run_hash text not null,
  player_name text not null,
  score bigint not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_leaderboard_submission_audit_session_time
  on public.leaderboard_submission_audit (session_id, created_at desc);

-- 3) Secure score submission RPC (server-side validation)
create or replace function public.submit_score_secure(
  p_player_name text,
  p_total_distance integer,
  p_enemies_defeated integer,
  p_levels_completed integer,
  p_score bigint,
  p_date text,
  p_client_proof jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_session_id text;
  v_nonce text;
  v_run_hash text;
  v_recent_count integer;
  v_bad_words text[] := array[
    'vittu', 'paska', 'saatana', 'perkele', 'fuck', 'shit', 'bitch', 'nazi'
  ];
begin
  v_name := upper(trim(coalesce(p_player_name, '')));
  v_name := regexp_replace(v_name, '\s+', ' ', 'g');
  v_name := regexp_replace(v_name, '[^A-Z0-9 _\-ÅÄÖ]', '', 'g');

  if length(v_name) < 2 or length(v_name) > 20 then
    return jsonb_build_object('ok', false, 'error', 'invalid_name_length');
  end if;

  if v_name !~ '^[A-Z0-9 _\-ÅÄÖ]+$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_name_chars');
  end if;

  if exists (
    select 1
    from unnest(v_bad_words) as w
    where position(w in lower(v_name)) > 0
  ) then
    return jsonb_build_object('ok', false, 'error', 'name_blocked');
  end if;

  if p_score < 100 or p_score > 50000000 then
    return jsonb_build_object('ok', false, 'error', 'invalid_score');
  end if;

  if p_total_distance < 0 or p_total_distance > 500000 then
    return jsonb_build_object('ok', false, 'error', 'invalid_distance');
  end if;

  if p_enemies_defeated < 0 or p_enemies_defeated > 50000 then
    return jsonb_build_object('ok', false, 'error', 'invalid_enemy_count');
  end if;

  if p_levels_completed < 0 or p_levels_completed > 11 then
    return jsonb_build_object('ok', false, 'error', 'invalid_levels');
  end if;

  v_session_id := coalesce(nullif(p_client_proof->>'session_id', ''), 'unknown');
  v_nonce := coalesce(nullif(p_client_proof->>'nonce', ''), 'missing');
  v_run_hash := coalesce(nullif(p_client_proof->>'run_hash', ''), 'missing');

  select count(*)
    into v_recent_count
  from public.leaderboard_submission_audit
  where session_id = v_session_id
    and created_at > now() - interval '5 minutes';

  if v_recent_count >= 20 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  insert into public.leaderboard_submission_audit (
    session_id, nonce, run_hash, player_name, score, payload
  ) values (
    v_session_id, v_nonce, v_run_hash, v_name, p_score, coalesce(p_client_proof, '{}'::jsonb)
  );

  insert into public.leaderboard (
    "playerName",
    "totalDistance",
    "enemiesDefeated",
    "levelsCompleted",
    "score",
    "date"
  ) values (
    v_name,
    p_total_distance,
    p_enemies_defeated,
    p_levels_completed,
    p_score,
    coalesce(nullif(p_date, ''), to_char(current_date, 'YYYY-MM-DD'))
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.submit_score_secure(
  text, integer, integer, integer, bigint, text, jsonb
) from public;

grant execute on function public.submit_score_secure(
  text, integer, integer, integer, bigint, text, jsonb
) to anon, authenticated;

-- 4) Optional: lock down direct inserts to leaderboard once RPC is in use
alter table public.leaderboard enable row level security;

drop policy if exists "leaderboard_select_all" on public.leaderboard;
create policy "leaderboard_select_all"
  on public.leaderboard
  for select
  to anon, authenticated
  using (true);

-- Do NOT create an insert policy for anon/authenticated if you want only RPC writes.
