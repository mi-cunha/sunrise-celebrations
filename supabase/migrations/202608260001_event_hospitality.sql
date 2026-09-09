-- Fase 3c: hospitalidade e materiais simples vinculados ao evento.
create type public.contracted_event_hospitality_category as enum ('cortesia', 'recepcao', 'mesa', 'pos_evento', 'material_impresso');
create type public.contracted_event_hospitality_status as enum ('planejado', 'aprovado', 'preparado', 'concluido', 'cancelado');

create table public.contracted_event_hospitality_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.contracted_events(id) on delete cascade,
  category public.contracted_event_hospitality_category not null,
  status public.contracted_event_hospitality_status not null default 'planejado',
  title text not null check (char_length(title) between 2 and 160),
  description text check (description is null or char_length(description) <= 1200),
  moment text check (moment is null or char_length(moment) <= 120),
  assigned_to uuid references public.profiles(id) on delete set null,
  visible_to_client boolean not null default false,
  linked_cost_id uuid unique references public.contracted_event_costs(id) on delete set null,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contracted_event_hospitality_event_idx on public.contracted_event_hospitality_items(event_id, category, created_at);
alter table public.contracted_event_hospitality_items enable row level security;
create policy "active users read hospitality items" on public.contracted_event_hospitality_items for select to authenticated using (public.is_active_user());
create trigger contracted_event_hospitality_touch_updated_at before update on public.contracted_event_hospitality_items for each row execute function public.touch_updated_at();

create function public.add_contracted_event_hospitality_item(
  p_event_id uuid, p_category public.contracted_event_hospitality_category, p_status public.contracted_event_hospitality_status,
  p_title text, p_description text default null, p_moment text default null, p_assigned_to uuid default null,
  p_visible_to_client boolean default false, p_estimated_amount_cents integer default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_item_id uuid; v_cost_id uuid; v_can_financial boolean;
begin
  if not public.can_manage_contracted_events() then raise exception 'Sem permissão para gerenciar hospitalidade.' using errcode = '42501'; end if;
  if not exists (select 1 from public.contracted_events where id = p_event_id) then raise exception 'Evento não encontrado.' using errcode = 'P0002'; end if;
  if char_length(trim(p_title)) < 2 then raise exception 'Informe o item de hospitalidade.' using errcode = '22023'; end if;
  if p_estimated_amount_cents is not null and p_estimated_amount_cents < 0 then raise exception 'O custo estimado não pode ser negativo.' using errcode = '22023'; end if;
  v_can_financial := public.can_manage_event_financials();
  if p_estimated_amount_cents is not null and p_estimated_amount_cents > 0 and not v_can_financial then raise exception 'Sem permissão para registrar custos.' using errcode = '42501'; end if;
  if p_estimated_amount_cents is not null and p_estimated_amount_cents > 0 then
    insert into public.contracted_event_costs(event_id, category, status, description, estimated_amount_cents, created_by)
    values (p_event_id, case when p_category = 'cortesia' then 'cortesia'::public.contracted_event_cost_category else 'outro'::public.contracted_event_cost_category end, 'previsto', '[Hospitalidade] ' || trim(p_title), p_estimated_amount_cents, auth.uid()) returning id into v_cost_id;
  end if;
  insert into public.contracted_event_hospitality_items(event_id, category, status, title, description, moment, assigned_to, visible_to_client, linked_cost_id, created_by)
  values (p_event_id, p_category, p_status, trim(p_title), nullif(trim(coalesce(p_description, '')), ''), nullif(trim(coalesce(p_moment, '')), ''), p_assigned_to, p_visible_to_client, v_cost_id, auth.uid()) returning id into v_item_id;
  insert into public.contracted_event_history(event_id, actor_id, action, metadata) values (p_event_id, auth.uid(), 'Item de hospitalidade adicionado', jsonb_build_object('item_id', v_item_id, 'title', trim(p_title)));
  return v_item_id;
end; $$;

create function public.update_contracted_event_hospitality_item(
  p_item_id uuid, p_category public.contracted_event_hospitality_category, p_status public.contracted_event_hospitality_status,
  p_title text, p_description text default null, p_moment text default null, p_assigned_to uuid default null,
  p_visible_to_client boolean default false, p_estimated_amount_cents integer default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_event_id uuid; v_cost_id uuid; v_can_financial boolean;
begin
  if not public.can_manage_contracted_events() then raise exception 'Sem permissão para gerenciar hospitalidade.' using errcode = '42501'; end if;
  select event_id, linked_cost_id into v_event_id, v_cost_id from public.contracted_event_hospitality_items where id = p_item_id;
  if v_event_id is null then raise exception 'Item de hospitalidade não encontrado.' using errcode = 'P0002'; end if;
  if char_length(trim(p_title)) < 2 or (p_estimated_amount_cents is not null and p_estimated_amount_cents < 0) then raise exception 'Revise o item de hospitalidade.' using errcode = '22023'; end if;
  v_can_financial := public.can_manage_event_financials();
  if p_estimated_amount_cents is not null and (v_cost_id is not null or p_estimated_amount_cents > 0) and not v_can_financial then raise exception 'Sem permissão para alterar custos.' using errcode = '42501'; end if;
  if p_estimated_amount_cents is not null and p_estimated_amount_cents > 0 and v_cost_id is null then
    insert into public.contracted_event_costs(event_id, category, status, description, estimated_amount_cents, created_by) values (v_event_id, case when p_category = 'cortesia' then 'cortesia'::public.contracted_event_cost_category else 'outro'::public.contracted_event_cost_category end, 'previsto', '[Hospitalidade] ' || trim(p_title), p_estimated_amount_cents, auth.uid()) returning id into v_cost_id;
  elsif v_cost_id is not null and p_estimated_amount_cents is not null then
    update public.contracted_event_costs set category = case when p_category = 'cortesia' then 'cortesia'::public.contracted_event_cost_category else 'outro'::public.contracted_event_cost_category end, description = '[Hospitalidade] ' || trim(p_title), estimated_amount_cents = p_estimated_amount_cents, status = case when p_status = 'cancelado' then 'cancelado'::public.contracted_event_cost_status else status end where id = v_cost_id;
  end if;
  update public.contracted_event_hospitality_items set category=p_category, status=p_status, title=trim(p_title), description=nullif(trim(coalesce(p_description, '')), ''), moment=nullif(trim(coalesce(p_moment, '')), ''), assigned_to=p_assigned_to, visible_to_client=p_visible_to_client, linked_cost_id=v_cost_id where id=p_item_id;
  insert into public.contracted_event_history(event_id, actor_id, action, metadata) values (v_event_id, auth.uid(), 'Item de hospitalidade atualizado', jsonb_build_object('item_id', p_item_id, 'title', trim(p_title)));
  return v_event_id;
end; $$;

create function public.remove_contracted_event_hospitality_item(p_item_id uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare v_event_id uuid; v_cost_id uuid; v_title text;
begin
  if not public.can_manage_contracted_events() then raise exception 'Sem permissão para gerenciar hospitalidade.' using errcode = '42501'; end if;
  select event_id, linked_cost_id, title into v_event_id, v_cost_id, v_title from public.contracted_event_hospitality_items where id = p_item_id;
  if v_event_id is null then raise exception 'Item de hospitalidade não encontrado.' using errcode = 'P0002'; end if;
  if v_cost_id is not null and not public.can_manage_event_financials() then raise exception 'Sem permissão para remover o custo vinculado.' using errcode = '42501'; end if;
  delete from public.contracted_event_hospitality_items where id = p_item_id;
  if v_cost_id is not null then delete from public.contracted_event_costs where id = v_cost_id; end if;
  insert into public.contracted_event_history(event_id, actor_id, action, metadata) values (v_event_id, auth.uid(), 'Item de hospitalidade removido', jsonb_build_object('item_id', p_item_id, 'title', v_title));
  return v_event_id;
end; $$;

grant select on public.contracted_event_hospitality_items to authenticated;
grant execute on function public.add_contracted_event_hospitality_item(uuid, public.contracted_event_hospitality_category, public.contracted_event_hospitality_status, text, text, text, uuid, boolean, integer) to authenticated;
grant execute on function public.update_contracted_event_hospitality_item(uuid, public.contracted_event_hospitality_category, public.contracted_event_hospitality_status, text, text, text, uuid, boolean, integer) to authenticated;
grant execute on function public.remove_contracted_event_hospitality_item(uuid) to authenticated;
