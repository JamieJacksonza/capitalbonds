alter table public.deal_banks
  add column if not exists attorney text,
  add column if not exists attorney_note text;

NOTIFY pgrst, 'reload schema';
