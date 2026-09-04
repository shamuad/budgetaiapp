begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('c0000000-0000-4000-8000-000000000001', 'quota-a@budgree.test', '{}'),
  ('d0000000-0000-4000-8000-000000000002', 'quota-b@budgree.test', '{}');

set local role anon;
set local "request.jwt.claim.sub" = 'c0000000-0000-4000-8000-000000000001';
set local "request.jwt.claim.role" = 'anon';

select throws_ok(
  $$select public.consume_request_quota('ai')$$,
  '42501',
  'anon cannot consume an authenticated quota'
);

set local role authenticated;
set local "request.jwt.claim.role" = 'authenticated';

select ok(
  (public.consume_request_quota('ai')->>'allowed')::boolean,
  'the first AI request is allowed'
);

select is(
  public.consume_request_quota('ai')->>'remaining',
  '8',
  'AI quota reports the most restrictive remaining allowance'
);

do $$
begin
  for counter in 1..8 loop
    perform public.consume_request_quota('ai');
  end loop;
end;
$$;

select is(
  public.consume_request_quota('ai')->>'allowed',
  'false',
  'the eleventh AI request in a minute is rejected'
);

select is(
  public.consume_request_quota('ai')->>'reason',
  'rate_limited',
  'burst exhaustion returns a rate-limit reason'
);

set local "request.jwt.claim.sub" = 'd0000000-0000-4000-8000-000000000002';

select ok(
  (public.consume_request_quota('ai')->>'allowed')::boolean,
  'quota counters are isolated per user'
);

reset role;

update public.request_quota_counters
set request_count = 300
where user_id = 'd0000000-0000-4000-8000-000000000002'
  and resource = 'ai'
  and window_name = 'month';

set local role authenticated;
set local "request.jwt.claim.sub" = 'd0000000-0000-4000-8000-000000000002';
set local "request.jwt.claim.role" = 'authenticated';

select is(
  public.consume_request_quota('ai')->>'allowed',
  'false',
  'the monthly AI quota is enforced'
);

select is(
  public.consume_request_quota('ai')->>'reason',
  'quota_exhausted',
  'monthly exhaustion returns a quota reason'
);

select ok(
  (public.consume_request_quota('finance_search')->>'allowed')::boolean,
  'finance search has an independent allowance'
);

select throws_ok(
  $$select public.consume_request_quota('not_a_resource')$$,
  '22023',
  'callers cannot invent quota resources or limits'
);

select throws_ok(
  $$select count(*) from public.request_quota_counters$$,
  '42501',
  'authenticated clients cannot inspect quota counters'
);

reset role;

select is(
  (select count(*) from public.request_quota_counters),
  6::bigint,
  'only the expected per-user and per-window counters exist'
);

select * from finish();
rollback;
