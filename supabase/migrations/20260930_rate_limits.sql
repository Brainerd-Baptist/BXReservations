-- C1: fixed-window rate limits for public endpoints (sign-up, reset, booking…).
-- Keys are hashed IPs / emails, never raw. Server-only (service key).
create table if not exists public.bx_rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits integer not null default 0
);
alter table public.bx_rate_limits enable row level security;
revoke all on public.bx_rate_limits from anon, authenticated;

create or replace function public.bx_rate_hit(p_key text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.bx_rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into n;
  -- occasional cleanup of stale windows
  if random() < 0.01 then
    delete from public.bx_rate_limits where window_start < now() - interval '2 days';
  end if;
  return n <= p_max;
end;
$$;
revoke execute on function public.bx_rate_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.bx_rate_hit(text, integer, integer) to service_role;
