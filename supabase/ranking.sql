-- Volt-Mates: ejecutar en el SQL Editor de un proyecto Supabase.
-- Lectura pública; escritura sólo mediante RPC con validación y UUID idempotente.
begin;

create table if not exists public.duo_scores (
  id uuid primary key,
  season text not null check (season = 'expedition-7'),
  duo_name varchar(24) not null check (length(btrim(duo_name)) between 1 and 24 and duo_name !~ '[[:cntrl:]<>]'),
  pilot_one varchar(16) not null check (length(btrim(pilot_one)) between 1 and 16 and pilot_one !~ '[[:cntrl:]<>]'),
  pilot_two varchar(16) not null check (length(btrim(pilot_two)) between 1 and 16 and pilot_two !~ '[[:cntrl:]<>]'),
  score integer not null check (score between 1 and 1000000),
  waves integer not null check (waves between 0 and 6),
  kills integer not null check (kills between 0 and 55),
  duration_ms integer not null check (duration_ms between 1000 and 7200000),
  won boolean not null,
  mode text not null check (mode in ('local', 'online')),
  created_at timestamptz not null default now(),
  check (won = (waves = 6))
);

alter table public.duo_scores enable row level security;
revoke all on public.duo_scores from anon, authenticated;
grant select on public.duo_scores to anon, authenticated;
drop policy if exists "Read duo scores" on public.duo_scores;
create policy "Read duo scores" on public.duo_scores
  for select to anon, authenticated using (true);

create index if not exists duo_scores_order
  on public.duo_scores (season, score desc, waves desc, duration_ms asc);

-- La fecha la fija el servidor. No se permite modificar ni borrar partidas desde el cliente.
create or replace function public.submit_duo_score(p_entry jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  entry_id uuid;
begin
  if jsonb_typeof(p_entry) <> 'object'
    or jsonb_typeof(p_entry->'score') is distinct from 'number'
    or jsonb_typeof(p_entry->'waves') is distinct from 'number'
    or jsonb_typeof(p_entry->'kills') is distinct from 'number'
    or jsonb_typeof(p_entry->'duration_ms') is distinct from 'number'
    or jsonb_typeof(p_entry->'won') is distinct from 'boolean'
    or (p_entry->>'id') is null
    or (p_entry->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or (p_entry->>'score') !~ '^[0-9]+$'
    or (p_entry->>'waves') !~ '^[0-9]+$'
    or (p_entry->>'kills') !~ '^[0-9]+$'
    or (p_entry->>'duration_ms') !~ '^[0-9]+$'
  then raise exception 'Invalid score payload' using errcode = '22023'; end if;

  entry_id := (p_entry->>'id')::uuid;
  insert into public.duo_scores (id, season, duo_name, pilot_one, pilot_two, score, waves, kills, duration_ms, won, mode)
  values (
    entry_id, p_entry->>'season',
    regexp_replace(btrim(p_entry->>'duo_name'), '[[:space:]]+', ' ', 'g'),
    regexp_replace(btrim(p_entry->>'pilot_one'), '[[:space:]]+', ' ', 'g'),
    regexp_replace(btrim(p_entry->>'pilot_two'), '[[:space:]]+', ' ', 'g'),
    (p_entry->>'score')::integer, (p_entry->>'waves')::integer,
    (p_entry->>'kills')::integer, (p_entry->>'duration_ms')::integer,
    (p_entry->>'won')::boolean, p_entry->>'mode'
  ) on conflict (id) do nothing;
  return entry_id;
end;
$$;

revoke all on function public.submit_duo_score(jsonb) from public;
grant execute on function public.submit_duo_score(jsonb) to anon, authenticated;

-- Una fila por nombre de dúo y pareja, incluso si intercambian sus puestos.
-- security_invoker conserva la política de lectura al consultar la vista.
create or replace view public.duo_leaderboard with (security_invoker = true) as
select distinct on (
  season, lower(duo_name),
  least(lower(pilot_one), lower(pilot_two)), greatest(lower(pilot_one), lower(pilot_two))
) id, season, duo_name, pilot_one, pilot_two, score, waves, kills, duration_ms, won, mode, created_at
from public.duo_scores
order by season, lower(duo_name),
  least(lower(pilot_one), lower(pilot_two)), greatest(lower(pilot_one), lower(pilot_two)),
  score desc, waves desc, duration_ms asc, created_at asc, id asc;

revoke all on public.duo_leaderboard from anon, authenticated;
grant select on public.duo_leaderboard to anon, authenticated;
commit;
