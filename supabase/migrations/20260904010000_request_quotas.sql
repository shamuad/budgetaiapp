-- Per-user abuse protection shared by the Gemini Edge Function and the web
-- finance proxy. Clients cannot read or mutate counters directly; they can
-- only ask this SECURITY DEFINER function to atomically consume a known quota.

create table public.request_quota_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  resource text not null,
  window_name text not null,
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, resource, window_name, window_start)
);

alter table public.request_quota_counters enable row level security;

revoke all on table public.request_quota_counters from public, anon, authenticated;

create or replace function public.consume_request_quota(p_resource text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  v_short_window_name text;
  v_short_window_start timestamptz;
  v_short_window_end timestamptz;
  v_short_limit integer;
  v_long_window_name text;
  v_long_window_start timestamptz;
  v_long_window_end timestamptz;
  v_long_limit integer;
  v_short_count integer;
  v_long_count integer;
  v_retry_after integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  case p_resource
    when 'ai' then
      v_short_window_name := 'minute';
      v_short_window_start := date_trunc('minute', v_now);
      v_short_window_end := v_short_window_start + interval '1 minute';
      v_short_limit := 10;
      v_long_window_name := 'month';
      v_long_window_start := date_trunc('month', v_now at time zone 'UTC') at time zone 'UTC';
      v_long_window_end := v_long_window_start + interval '1 month';
      v_long_limit := 300;
    when 'finance_search' then
      v_short_window_name := 'minute';
      v_short_window_start := date_trunc('minute', v_now);
      v_short_window_end := v_short_window_start + interval '1 minute';
      v_short_limit := 30;
      v_long_window_name := 'day';
      v_long_window_start := date_trunc('day', v_now at time zone 'UTC') at time zone 'UTC';
      v_long_window_end := v_long_window_start + interval '1 day';
      v_long_limit := 500;
    when 'finance_quote' then
      v_short_window_name := 'minute';
      v_short_window_start := date_trunc('minute', v_now);
      v_short_window_end := v_short_window_start + interval '1 minute';
      v_short_limit := 60;
      v_long_window_name := 'day';
      v_long_window_start := date_trunc('day', v_now at time zone 'UTC') at time zone 'UTC';
      v_long_window_end := v_long_window_start + interval '1 day';
      v_long_limit := 1000;
    else
      raise exception using errcode = '22023', message = 'Unknown quota resource.';
  end case;

  -- Serialize consumption for one user/resource so simultaneous requests cannot
  -- both observe the same remaining allowance.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_resource, 0)
  );

  select coalesce(max(counter.request_count), 0)
  into v_short_count
  from public.request_quota_counters counter
  where counter.user_id = v_user_id
    and counter.resource = p_resource
    and counter.window_name = v_short_window_name
    and counter.window_start = v_short_window_start;

  if v_short_count >= v_short_limit then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from (v_short_window_end - v_now)))::integer
    );

    return jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limited',
      'remaining', 0,
      'retry_after_seconds', v_retry_after
    );
  end if;

  select coalesce(max(counter.request_count), 0)
  into v_long_count
  from public.request_quota_counters counter
  where counter.user_id = v_user_id
    and counter.resource = p_resource
    and counter.window_name = v_long_window_name
    and counter.window_start = v_long_window_start;

  if v_long_count >= v_long_limit then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from (v_long_window_end - v_now)))::integer
    );

    return jsonb_build_object(
      'allowed', false,
      'reason', 'quota_exhausted',
      'remaining', 0,
      'retry_after_seconds', v_retry_after
    );
  end if;

  insert into public.request_quota_counters (
    user_id, resource, window_name, window_start, request_count, updated_at
  )
  values (
    v_user_id, p_resource, v_short_window_name, v_short_window_start, 1, v_now
  )
  on conflict (user_id, resource, window_name, window_start)
  do update set
    request_count = public.request_quota_counters.request_count + 1,
    updated_at = excluded.updated_at;

  insert into public.request_quota_counters (
    user_id, resource, window_name, window_start, request_count, updated_at
  )
  values (
    v_user_id, p_resource, v_long_window_name, v_long_window_start, 1, v_now
  )
  on conflict (user_id, resource, window_name, window_start)
  do update set
    request_count = public.request_quota_counters.request_count + 1,
    updated_at = excluded.updated_at;

  -- Bound table growth without a separate maintenance task.
  delete from public.request_quota_counters counter
  where counter.user_id = v_user_id
    and counter.updated_at < v_now - interval '40 days';

  return jsonb_build_object(
    'allowed', true,
    'reason', null,
    'remaining', least(
      v_short_limit - v_short_count - 1,
      v_long_limit - v_long_count - 1
    ),
    'retry_after_seconds', 0
  );
end;
$$;

revoke execute on function public.consume_request_quota(text)
  from public, anon;
grant execute on function public.consume_request_quota(text)
  to authenticated;

comment on function public.consume_request_quota(text) is
  'Atomically consumes the authenticated user quota for a supported API resource.';
