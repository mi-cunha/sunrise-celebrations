alter table public.quotes
  add column if not exists sent_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists refused_at timestamptz,
  add column if not exists decision_reason text check (decision_reason is null or char_length(decision_reason) <= 1200),
  add column if not exists admin_edit_unlocked boolean not null default false,
  add column if not exists edit_unlocked_by uuid references public.profiles(id) on delete set null,
  add column if not exists edit_unlocked_at timestamptz;

create or replace function public.can_edit_quote(p_quote_id uuid) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.quotes q
    where q.id = p_quote_id
      and public.can_manage_quotes()
      and (
        q.status <> 'aprovado'
        or q.admin_edit_unlocked
        or public.has_permission('admin_owner')
      )
  );
$$;

grant execute on function public.can_edit_quote(uuid) to authenticated;

create or replace function public.add_quote_item(
  p_quote_id uuid,
  p_description text,
  p_quantity numeric,
  p_unit_price_cents integer
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_item_id uuid;
begin
  if not public.can_edit_quote(p_quote_id) then
    raise exception 'quote editing is locked' using errcode = '42501';
  end if;

  insert into public.quote_items (quote_id, description, quantity, unit_price_cents)
  values (p_quote_id, p_description, p_quantity, p_unit_price_cents)
  returning id into new_item_id;

  perform public.recalculate_quote_total(p_quote_id);

  insert into public.quote_history (quote_id, actor_id, action, metadata)
  values (p_quote_id, auth.uid(), 'Item adicionado', jsonb_build_object('item_id', new_item_id, 'description', p_description));

  return new_item_id;
end;
$$;

create or replace function public.update_quote_item(
  p_item_id uuid,
  p_description text,
  p_quantity numeric,
  p_unit_price_cents integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_quote_id uuid;
begin
  select quote_id
  into target_quote_id
  from public.quote_items
  where id = p_item_id;

  if target_quote_id is null then
    raise exception 'quote item not found' using errcode = 'P0002';
  end if;

  if not public.can_edit_quote(target_quote_id) then
    raise exception 'quote editing is locked' using errcode = '42501';
  end if;

  update public.quote_items
  set
    description = trim(p_description),
    quantity = p_quantity,
    unit_price_cents = p_unit_price_cents
  where id = p_item_id;

  perform public.recalculate_quote_total(target_quote_id);

  insert into public.quote_history (quote_id, actor_id, action, metadata)
  values (
    target_quote_id,
    auth.uid(),
    'Item atualizado',
    jsonb_build_object('item_id', p_item_id, 'description', trim(p_description))
  );

  return target_quote_id;
end;
$$;

create or replace function public.remove_quote_item(p_item_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_quote_id uuid;
  removed_description text;
begin
  select quote_id, description
  into target_quote_id, removed_description
  from public.quote_items
  where id = p_item_id;

  if target_quote_id is null then
    raise exception 'quote item not found' using errcode = 'P0002';
  end if;

  if not public.can_edit_quote(target_quote_id) then
    raise exception 'quote editing is locked' using errcode = '42501';
  end if;

  delete from public.quote_items
  where id = p_item_id;

  perform public.recalculate_quote_total(target_quote_id);

  insert into public.quote_history (quote_id, actor_id, action, metadata)
  values (
    target_quote_id,
    auth.uid(),
    'Item removido',
    jsonb_build_object('item_id', p_item_id, 'description', removed_description)
  );

  return target_quote_id;
end;
$$;

create or replace function public.update_quote_status(
  p_quote_id uuid,
  p_status public.quote_status,
  p_reason text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_row public.quotes%rowtype;
  old_status public.quote_status;
  normalized_reason text;
begin
  if not public.can_manage_quotes() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  normalized_reason := nullif(trim(coalesce(p_reason, '')), '');
  if p_status in ('aprovado', 'recusado') and normalized_reason is null then
    raise exception 'decision reason is required' using errcode = '22023';
  end if;

  select * into quote_row from public.quotes where id = p_quote_id;
  if quote_row.id is null then
    raise exception 'quote not found' using errcode = 'P0002';
  end if;

  old_status := quote_row.status;
  update public.quotes
  set
    status = p_status,
    sent_at = case when p_status = 'enviado' and sent_at is null then now() else sent_at end,
    approved_at = case when p_status = 'aprovado' then now() else approved_at end,
    refused_at = case when p_status = 'recusado' then now() else refused_at end,
    decision_reason = case when p_status in ('aprovado', 'recusado') then normalized_reason else decision_reason end,
    admin_edit_unlocked = case when p_status = 'aprovado' then false else admin_edit_unlocked end
  where id = p_quote_id;

  if old_status is distinct from p_status then
    insert into public.quote_history (quote_id, actor_id, action, metadata)
    values (p_quote_id, auth.uid(), 'Status do orçamento alterado', jsonb_build_object('from', old_status, 'to', p_status, 'reason', normalized_reason));

    if p_status = 'enviado' then
      update public.leads set status = 'proposta_enviada' where id = quote_row.lead_id;
      insert into public.lead_history (lead_id, actor_id, action, metadata)
      values (quote_row.lead_id, auth.uid(), 'Proposta enviada', jsonb_build_object('quote_id', p_quote_id));
    elsif p_status = 'aprovado' then
      update public.leads set status = 'ganho' where id = quote_row.lead_id;
      insert into public.lead_history (lead_id, actor_id, action, metadata)
      values (quote_row.lead_id, auth.uid(), 'Orçamento aprovado', jsonb_build_object('quote_id', p_quote_id, 'reason', normalized_reason));
    elsif p_status = 'recusado' then
      update public.leads set status = 'perdido' where id = quote_row.lead_id;
      insert into public.lead_history (lead_id, actor_id, action, metadata)
      values (quote_row.lead_id, auth.uid(), 'Orçamento recusado', jsonb_build_object('quote_id', p_quote_id, 'reason', normalized_reason));
    end if;
  end if;
end;
$$;

create or replace function public.set_approved_quote_edit_lock(
  p_quote_id uuid,
  p_unlocked boolean,
  p_reason text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_status public.quote_status;
begin
  if not public.has_permission('admin_owner') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select status into quote_status from public.quotes where id = p_quote_id;
  if quote_status is null then
    raise exception 'quote not found' using errcode = 'P0002';
  end if;
  if quote_status <> 'aprovado' then
    raise exception 'only approved quotes can be locked or unlocked' using errcode = '22023';
  end if;

  update public.quotes
  set
    admin_edit_unlocked = p_unlocked,
    edit_unlocked_by = case when p_unlocked then auth.uid() else edit_unlocked_by end,
    edit_unlocked_at = case when p_unlocked then now() else edit_unlocked_at end
  where id = p_quote_id;

  insert into public.quote_history (quote_id, actor_id, action, metadata)
  values (
    p_quote_id,
    auth.uid(),
    case when p_unlocked then 'Edição pós-aprovação liberada' else 'Edição pós-aprovação bloqueada' end,
    jsonb_build_object('reason', nullif(trim(coalesce(p_reason, '')), ''))
  );
end;
$$;

grant execute on function public.update_quote_status(uuid, public.quote_status, text) to authenticated;
grant execute on function public.set_approved_quote_edit_lock(uuid, boolean, text) to authenticated;

create or replace function public.add_quote_proposal_option(
  p_quote_id uuid,
  p_catalog_option_id uuid,
  p_title text,
  p_content text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  catalog_row public.proposal_option_catalog%rowtype;
  new_option_id uuid;
  final_title text;
  final_content text;
begin
  if not public.can_edit_quote(p_quote_id) then
    raise exception 'quote editing is locked' using errcode = '42501';
  end if;

  if p_catalog_option_id is not null then
    select * into catalog_row
    from public.proposal_option_catalog
    where id = p_catalog_option_id and is_active;

    if catalog_row.id is null then
      raise exception 'proposal option not found' using errcode = 'P0002';
    end if;

    final_title := catalog_row.title;
    final_content := catalog_row.content;
  else
    final_title := trim(p_title);
    final_content := trim(p_content);
  end if;

  insert into public.quote_proposal_options (quote_id, catalog_option_id, title, content)
  values (p_quote_id, p_catalog_option_id, final_title, final_content)
  returning id into new_option_id;

  insert into public.quote_history (quote_id, actor_id, action, metadata)
  values (p_quote_id, auth.uid(), 'Opção adicionada à proposta', jsonb_build_object('option_id', new_option_id, 'title', final_title));

  return new_option_id;
end;
$$;

create or replace function public.remove_quote_proposal_option(p_option_id uuid) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_quote_id uuid;
  removed_title text;
begin
  select quote_id, title
  into target_quote_id, removed_title
  from public.quote_proposal_options
  where id = p_option_id;

  if target_quote_id is null then
    raise exception 'proposal option not found' using errcode = 'P0002';
  end if;

  if not public.can_edit_quote(target_quote_id) then
    raise exception 'quote editing is locked' using errcode = '42501';
  end if;

  delete from public.quote_proposal_options
  where id = p_option_id;

  insert into public.quote_history (quote_id, actor_id, action, metadata)
  values (target_quote_id, auth.uid(), 'Opção removida da proposta', jsonb_build_object('option_id', p_option_id, 'title', removed_title));

  return target_quote_id;
end;
$$;

grant execute on function public.add_quote_proposal_option(uuid, uuid, text, text) to authenticated;
grant execute on function public.remove_quote_proposal_option(uuid) to authenticated;
