-- Regras da biblioteca passam a alimentar os mesmos itens de pacote usados por
-- orçamento, proposta e ficha operacional. Os itens antigos permanecem intactos.
alter table public.event_package_items
  drop constraint if exists event_package_items_category_check;
alter table public.event_package_items
  add constraint event_package_items_category_check
  check (category in ('buffet', 'bebida', 'servico', 'estrutura', 'decoracao', 'observacao', 'outro'));

alter table public.event_package_items
  add column if not exists source_rule_item_id uuid unique
    references public.event_package_rule_items(id) on delete restrict;

create or replace function public.sync_package_rule_item(p_rule_item_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare source_row record;
begin
  select ri.id, r.package_id, s.category, i.name,
    coalesce(nullif(i.proposal_description, ''), nullif(i.operational_description, '')) as description,
    (r.show_in_proposal and i.show_in_proposal) as show_in_proposal,
    (r.show_in_operational_brief and i.show_in_operational_brief) as show_in_operational_brief,
    (r.selection_max > 0) as is_choice,
    coalesce(nullif(r.title, ''), s.name) as choice_group,
    case when r.is_required and r.selection_max > 0 then greatest(r.selection_min, 1) else r.selection_min end as selection_min,
    r.selection_max, ri.sort_order
  into source_row
  from public.event_package_rule_items ri
  join public.event_package_rules r on r.id = ri.package_rule_id
  join public.event_package_subcategories s on s.id = r.subcategory_id
  join public.event_package_item_catalog i on i.id = ri.item_catalog_id
  where ri.id = p_rule_item_id;
  if not found then return; end if;

  -- Quando a mesma linha já foi cadastrada no modelo antigo, aproveita o
  -- identificador original para manter escolhas anteriores ligadas ao item.
  if not exists (select 1 from public.event_package_items where source_rule_item_id = source_row.id) then
    update public.event_package_items set source_rule_item_id = source_row.id
    where id = (
      select id from public.event_package_items
      where package_id = source_row.package_id
        and category = source_row.category
        and lower(trim(name)) = lower(trim(source_row.name))
        and source_rule_item_id is null
      order by created_at, id limit 1
    );
  end if;

  insert into public.event_package_items (
    package_id, category, name, description, show_in_proposal,
    show_in_operational_brief, is_choice, choice_group, choice_min,
    choice_max, sort_order, source_rule_item_id
  ) values (
    source_row.package_id, source_row.category, source_row.name, source_row.description,
    source_row.show_in_proposal, source_row.show_in_operational_brief,
    source_row.is_choice,
    case when source_row.is_choice then source_row.choice_group else null end,
    case when source_row.is_choice then source_row.selection_min else null end,
    case when source_row.is_choice then source_row.selection_max else null end,
    source_row.sort_order, source_row.id
  ) on conflict (source_rule_item_id) do update set
    package_id = excluded.package_id,
    category = excluded.category,
    name = excluded.name,
    description = excluded.description,
    show_in_proposal = excluded.show_in_proposal,
    show_in_operational_brief = excluded.show_in_operational_brief,
    is_choice = excluded.is_choice,
    choice_group = excluded.choice_group,
    choice_min = excluded.choice_min,
    choice_max = excluded.choice_max,
    sort_order = excluded.sort_order;
end;
$$;

create or replace function public.sync_package_rule_item_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.sync_package_rule_item(new.id);
  return new;
end;
$$;
create trigger event_package_rule_item_sync
after insert or update on public.event_package_rule_items
for each row execute function public.sync_package_rule_item_insert();

create or replace function public.sync_package_rule_items_for_rule() returns trigger
language plpgsql security definer set search_path = public as $$
declare rule_item_id uuid;
begin
  for rule_item_id in select id from public.event_package_rule_items where package_rule_id = new.id loop
    perform public.sync_package_rule_item(rule_item_id);
  end loop;
  return new;
end;
$$;
create trigger event_package_rule_sync
after update on public.event_package_rules
for each row execute function public.sync_package_rule_items_for_rule();

create or replace function public.sync_package_rule_items_for_library_item() returns trigger
language plpgsql security definer set search_path = public as $$
declare rule_item_id uuid;
begin
  for rule_item_id in select id from public.event_package_rule_items where item_catalog_id = new.id loop
    perform public.sync_package_rule_item(rule_item_id);
  end loop;
  return new;
end;
$$;
create trigger event_package_library_item_sync
after update on public.event_package_item_catalog
for each row execute function public.sync_package_rule_items_for_library_item();

-- Inclui as regras já cadastradas antes da unificação.
select public.sync_package_rule_item(id) from public.event_package_rule_items;
revoke all on function public.sync_package_rule_item(uuid) from public;
