create table public.option_catalog (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('event_type', 'lead_source')),
  name text not null check (char_length(trim(name)) between 2 and 80),
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create unique index option_catalog_kind_name_idx on public.option_catalog (kind, lower(name));

alter table public.option_catalog enable row level security;

create policy "active users read options" on public.option_catalog for select to authenticated using (public.is_active_user());
create policy "owners insert options" on public.option_catalog for insert to authenticated with check (public.has_permission('admin_owner'));
create policy "owners update options" on public.option_catalog for update to authenticated using (public.has_permission('admin_owner')) with check (public.has_permission('admin_owner'));

insert into public.option_catalog (kind, name, sort_order) values
  ('event_type', 'Casamento', 10),
  ('event_type', 'Corporativo', 20),
  ('event_type', 'Aniversário', 30),
  ('event_type', 'Café da manhã', 40),
  ('event_type', 'Formatura', 50),
  ('event_type', 'Confraternização', 60),
  ('event_type', 'Brunch', 70),
  ('event_type', 'Almoço', 80),
  ('event_type', 'Jantar', 90),
  ('event_type', 'Outro', 100),
  ('lead_source', 'WhatsApp', 10),
  ('lead_source', 'Instagram', 20),
  ('lead_source', 'Indicação', 30),
  ('lead_source', 'Site', 40),
  ('lead_source', 'Evento', 50),
  ('lead_source', 'Parceiro', 60),
  ('lead_source', 'Retorno', 70),
  ('lead_source', 'Outro', 80)
on conflict do nothing;
