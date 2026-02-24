-- Add role access column for consultant/admin permissions
alter table if exists public.consultants
  add column if not exists role text;

-- Backfill existing/null rows
update public.consultants
set role = 'consultant'
where role is null or btrim(role) = '';

-- Optional bootstrap: keep existing Admin user as admin by name
update public.consultants
set role = 'admin'
where lower(btrim(name)) = 'admin';

-- Restrict valid values
alter table public.consultants
  drop constraint if exists consultants_role_check;

alter table public.consultants
  add constraint consultants_role_check
  check (role in ('consultant', 'admin'));

-- Enforce non-null + default for new users
alter table public.consultants
  alter column role set default 'consultant',
  alter column role set not null;
