-- Propostas intermediárias: itens escolhíveis dentro do pacote e escolhas salvas no orçamento.
alter table public.event_package_items
  add column if not exists is_choice boolean not null default false,
  add column if not exists choice_group text check (choice_group is null or char_length(choice_group) between 2 and 120),
  add column if not exists choice_min integer check (choice_min is null or choice_min >= 0),
  add column if not exists choice_max integer check (choice_max is null or choice_max >= 1);

create table if not exists public.quote_package_item_choices (
  id uuid primary key default gen_random_uuid(),
  quote_package_id uuid not null references public.quote_packages(id) on delete cascade,
  package_item_id uuid not null references public.event_package_items(id) on delete restrict,
  selected_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (quote_package_id, package_item_id)
);

create index if not exists quote_package_item_choices_quote_package_idx
  on public.quote_package_item_choices (quote_package_id, created_at);

alter table public.quote_package_item_choices enable row level security;

create policy "active users read quote package item choices" on public.quote_package_item_choices
  for select to authenticated using (public.is_active_user());

create policy "quote managers create quote package item choices" on public.quote_package_item_choices
  for insert to authenticated with check (public.can_manage_quotes() and selected_by = auth.uid());

create policy "quote managers delete quote package item choices" on public.quote_package_item_choices
  for delete to authenticated using (public.can_manage_quotes());

create or replace function public.set_quote_package_item_choices(
  p_quote_id uuid,
  p_package_item_ids uuid[] default '{}'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_quote_package_id uuid;
  invalid_count integer;
begin
  if not public.can_edit_quote(p_quote_id) then
    raise exception 'quote editing is locked' using errcode = '42501';
  end if;

  select id into target_quote_package_id
  from public.quote_packages
  where quote_id = p_quote_id;

  if target_quote_package_id is null then
    raise exception 'quote package not found' using errcode = 'P0002';
  end if;

  select count(*) into invalid_count
  from unnest(coalesce(p_package_item_ids, '{}'::uuid[])) selected_item(id)
  where not exists (
    select 1
    from public.quote_packages qp
    join public.event_package_items epi on epi.package_id = qp.package_id
    where qp.id = target_quote_package_id
      and epi.id = selected_item.id
      and epi.is_choice
  );

  if invalid_count > 0 then
    raise exception 'invalid package choice' using errcode = '22023';
  end if;

  delete from public.quote_package_item_choices
  where quote_package_id = target_quote_package_id;

  insert into public.quote_package_item_choices (quote_package_id, package_item_id, selected_by)
  select distinct target_quote_package_id, selected_item.id, auth.uid()
  from unnest(coalesce(p_package_item_ids, '{}'::uuid[])) selected_item(id);

  insert into public.quote_history (quote_id, actor_id, action, metadata)
  values (
    p_quote_id,
    auth.uid(),
    'Escolhas do pacote atualizadas',
    jsonb_build_object('selected_count', coalesce(array_length(p_package_item_ids, 1), 0))
  );

  return target_quote_package_id;
end;
$$;

grant execute on function public.set_quote_package_item_choices(uuid, uuid[]) to authenticated;
