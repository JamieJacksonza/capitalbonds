create extension if not exists pgcrypto;

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  consultant text,
  name_and_surname text not null,
  cell text,
  email text,
  agency text,
  area text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calls_consultant_idx on public.calls (consultant);
create index if not exists calls_name_and_surname_idx on public.calls (name_and_surname);

create or replace function public.set_calls_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_calls_updated_at on public.calls;
create trigger set_calls_updated_at
before update on public.calls
for each row
execute function public.set_calls_updated_at();
