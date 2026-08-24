-- Pacotes 2.0: categorias/subcategorias, itens reutilizáveis e regras por pacote.
create table if not exists public.event_package_subcategories (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('buffet', 'bebida', 'servico', 'estrutura', 'decoracao', 'observacao', 'outro')),
  name text not null check (char_length(name) between 2 and 120),
  description text check (description is null or char_length(description) <= 800),
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category, name)
);

create table if not exists public.event_package_item_catalog (
  id uuid primary key default gen_random_uuid(),
  subcategory_id uuid not null references public.event_package_subcategories(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 160),
  proposal_description text check (proposal_description is null or char_length(proposal_description) <= 800),
  operational_description text check (operational_description is null or char_length(operational_description) <= 800),
  show_in_proposal boolean not null default true,
  show_in_operational_brief boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subcategory_id, name)
);

create table if not exists public.event_package_rules (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.event_package_catalog(id) on delete cascade,
  subcategory_id uuid not null references public.event_package_subcategories(id) on delete restrict,
  title text check (title is null or char_length(title) between 2 and 160),
  selection_min integer not null default 0 check (selection_min >= 0),
  selection_max integer not null default 0 check (selection_max >= 0),
  is_required boolean not null default false,
  show_in_proposal boolean not null default true,
  show_in_operational_brief boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (package_id, subcategory_id)
);

create table if not exists public.event_package_rule_items (
  id uuid primary key default gen_random_uuid(),
  package_rule_id uuid not null references public.event_package_rules(id) on delete cascade,
  item_catalog_id uuid not null references public.event_package_item_catalog(id) on delete restrict,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  unique (package_rule_id, item_catalog_id)
);

create table if not exists public.quote_package_rule_choices (
  id uuid primary key default gen_random_uuid(),
  quote_package_id uuid not null references public.quote_packages(id) on delete cascade,
  package_rule_id uuid not null references public.event_package_rules(id) on delete restrict,
  item_catalog_id uuid not null references public.event_package_item_catalog(id) on delete restrict,
  selected_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (quote_package_id, package_rule_id, item_catalog_id)
);

create index if not exists event_package_subcategories_category_idx
  on public.event_package_subcategories (category, is_active, sort_order, name);
create index if not exists event_package_item_catalog_subcategory_idx
  on public.event_package_item_catalog (subcategory_id, is_active, sort_order, name);
create index if not exists event_package_rules_package_idx
  on public.event_package_rules (package_id, sort_order, created_at);
create index if not exists event_package_rule_items_rule_idx
  on public.event_package_rule_items (package_rule_id, sort_order, created_at);
create index if not exists quote_package_rule_choices_quote_package_idx
  on public.quote_package_rule_choices (quote_package_id, created_at);

alter table public.event_package_subcategories enable row level security;
alter table public.event_package_item_catalog enable row level security;
alter table public.event_package_rules enable row level security;
alter table public.event_package_rule_items enable row level security;
alter table public.quote_package_rule_choices enable row level security;

create policy "active users read package subcategories" on public.event_package_subcategories
  for select to authenticated using (public.is_active_user());
create policy "admins create package subcategories" on public.event_package_subcategories
  for insert to authenticated with check (public.has_permission('admin_owner'));
create policy "admins update package subcategories" on public.event_package_subcategories
  for update to authenticated using (public.has_permission('admin_owner')) with check (public.has_permission('admin_owner'));

create policy "active users read package item catalog" on public.event_package_item_catalog
  for select to authenticated using (public.is_active_user());
create policy "admins create package item catalog" on public.event_package_item_catalog
  for insert to authenticated with check (public.has_permission('admin_owner'));
create policy "admins update package item catalog" on public.event_package_item_catalog
  for update to authenticated using (public.has_permission('admin_owner')) with check (public.has_permission('admin_owner'));

create policy "active users read package rules" on public.event_package_rules
  for select to authenticated using (public.is_active_user());
create policy "admins create package rules" on public.event_package_rules
  for insert to authenticated with check (public.has_permission('admin_owner'));
create policy "admins update package rules" on public.event_package_rules
  for update to authenticated using (public.has_permission('admin_owner')) with check (public.has_permission('admin_owner'));

create policy "active users read package rule items" on public.event_package_rule_items
  for select to authenticated using (public.is_active_user());
create policy "admins create package rule items" on public.event_package_rule_items
  for insert to authenticated with check (public.has_permission('admin_owner'));
create policy "admins delete package rule items" on public.event_package_rule_items
  for delete to authenticated using (public.has_permission('admin_owner'));

create policy "active users read quote package rule choices" on public.quote_package_rule_choices
  for select to authenticated using (public.is_active_user());
create policy "quote managers create quote package rule choices" on public.quote_package_rule_choices
  for insert to authenticated with check (public.can_manage_quotes() and selected_by = auth.uid());
create policy "quote managers delete quote package rule choices" on public.quote_package_rule_choices
  for delete to authenticated using (public.can_manage_quotes());

create trigger event_package_subcategories_touch_updated_at
  before update on public.event_package_subcategories
  for each row execute function public.touch_updated_at();

create trigger event_package_item_catalog_touch_updated_at
  before update on public.event_package_item_catalog
  for each row execute function public.touch_updated_at();

create trigger event_package_rules_touch_updated_at
  before update on public.event_package_rules
  for each row execute function public.touch_updated_at();
