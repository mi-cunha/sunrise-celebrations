create type public.contracted_event_cost_category as enum ('buffet', 'bebidas', 'equipe', 'fornecedor', 'decoracao', 'estrutura', 'transporte', 'cortesia', 'comissao', 'outro');
create type public.contracted_event_cost_status as enum ('previsto', 'confirmado', 'pago', 'cancelado');

create table public.contracted_event_costs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.contracted_events(id) on delete cascade,
  category public.contracted_event_cost_category not null,
  status public.contracted_event_cost_status not null default 'previsto',
  description text not null check (char_length(description) between 2 and 160),
  estimated_amount_cents integer not null check (estimated_amount_cents > 0),
  actual_amount_cents integer check (actual_amount_cents >= 0),
  due_date date,
  notes text check (notes is null or char_length(notes) <= 1200),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contracted_event_costs_event_id_idx on public.contracted_event_costs(event_id);
alter table public.contracted_event_costs enable row level security;

create policy "financial users select event costs" on public.contracted_event_costs for select to authenticated
  using (public.is_active_user() and public.can_manage_event_financials());
create policy "financial users insert event costs" on public.contracted_event_costs for insert to authenticated
  with check (public.can_manage_event_financials() and created_by = auth.uid());
create policy "financial users update event costs" on public.contracted_event_costs for update to authenticated
  using (public.can_manage_event_financials()) with check (public.can_manage_event_financials());
create policy "financial users delete event costs" on public.contracted_event_costs for delete to authenticated
  using (public.can_manage_event_financials());

create trigger contracted_event_costs_touch_updated_at before update on public.contracted_event_costs
  for each row execute function public.touch_updated_at();

create function public.add_contracted_event_cost(p_event_id uuid, p_category public.contracted_event_cost_category, p_status public.contracted_event_cost_status, p_description text, p_estimated_amount_cents integer, p_actual_amount_cents integer default null, p_due_date date default null, p_notes text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.can_manage_event_financials() then raise exception 'Sem permissão para gerenciar custos.'; end if;
  insert into public.contracted_event_costs(event_id, category, status, description, estimated_amount_cents, actual_amount_cents, due_date, notes, created_by)
  values (p_event_id, p_category, p_status, trim(p_description), p_estimated_amount_cents, p_actual_amount_cents, p_due_date, nullif(trim(p_notes), ''), auth.uid()) returning id into v_id;
  insert into public.contracted_event_history(event_id, action, metadata, actor_id)
  values (p_event_id, 'Custo interno adicionado', jsonb_build_object('cost_id', v_id, 'description', trim(p_description), 'estimated_amount_cents', p_estimated_amount_cents), auth.uid());
  return v_id;
end; $$;

create function public.update_contracted_event_cost(p_cost_id uuid, p_category public.contracted_event_cost_category, p_status public.contracted_event_cost_status, p_description text, p_estimated_amount_cents integer, p_actual_amount_cents integer default null, p_due_date date default null, p_notes text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_event_id uuid;
begin
  if not public.can_manage_event_financials() then raise exception 'Sem permissão para gerenciar custos.'; end if;
  update public.contracted_event_costs set category=p_category, status=p_status, description=trim(p_description), estimated_amount_cents=p_estimated_amount_cents, actual_amount_cents=p_actual_amount_cents, due_date=p_due_date, notes=nullif(trim(p_notes), '')
  where id=p_cost_id returning event_id into v_event_id;
  if v_event_id is null then raise exception 'Custo não encontrado.'; end if;
  insert into public.contracted_event_history(event_id, action, metadata, actor_id) values (v_event_id, 'Custo interno atualizado', jsonb_build_object('cost_id', p_cost_id), auth.uid());
  return v_event_id;
end; $$;

create function public.remove_contracted_event_cost(p_cost_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_event_id uuid; v_description text;
begin
  if not public.can_manage_event_financials() then raise exception 'Sem permissão para gerenciar custos.'; end if;
  delete from public.contracted_event_costs where id=p_cost_id returning event_id, description into v_event_id, v_description;
  if v_event_id is null then raise exception 'Custo não encontrado.'; end if;
  insert into public.contracted_event_history(event_id, action, metadata, actor_id) values (v_event_id, 'Custo interno removido', jsonb_build_object('cost_id', p_cost_id, 'description', v_description), auth.uid());
  return v_event_id;
end; $$;

grant select, insert, update, delete on public.contracted_event_costs to authenticated;
grant execute on function public.add_contracted_event_cost(uuid, public.contracted_event_cost_category, public.contracted_event_cost_status, text, integer, integer, date, text) to authenticated;
grant execute on function public.update_contracted_event_cost(uuid, public.contracted_event_cost_category, public.contracted_event_cost_status, text, integer, integer, date, text) to authenticated;
grant execute on function public.remove_contracted_event_cost(uuid) to authenticated;
