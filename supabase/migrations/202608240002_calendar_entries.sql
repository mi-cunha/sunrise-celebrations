-- Agenda operacional: datas internas, bloqueios e eventos da casa.
create type public.calendar_entry_type as enum ('evento_casa', 'data_importante', 'bloqueio', 'manutencao');

create table public.calendar_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 120),
  entry_type public.calendar_entry_type not null,
  start_date date not null,
  end_date date not null,
  notes text check (char_length(notes) <= 1200),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index calendar_entries_dates_idx on public.calendar_entries (start_date, end_date);
alter table public.calendar_entries enable row level security;

create policy "active users read calendar entries" on public.calendar_entries
  for select to authenticated using (public.is_active_user());
create policy "calendar managers insert entries" on public.calendar_entries
  for insert to authenticated with check ((public.has_permission('gerencia') or public.has_permission('admin_owner')) and created_by = auth.uid());
create policy "calendar managers update entries" on public.calendar_entries
  for update to authenticated using (public.has_permission('gerencia') or public.has_permission('admin_owner'))
  with check (public.has_permission('gerencia') or public.has_permission('admin_owner'));
create policy "calendar managers delete entries" on public.calendar_entries
  for delete to authenticated using (public.has_permission('gerencia') or public.has_permission('admin_owner'));

create trigger calendar_entries_touch_updated_at
  before update on public.calendar_entries
  for each row execute function public.touch_updated_at();
