-- Exclui orçamentos pelo contato, preservando histórico comercial e eventos contratados.
drop policy if exists "quote managers delete quotes" on public.quotes;
create policy "quote managers delete quotes"
  on public.quotes for delete to authenticated
  using (
    public.can_manage_quotes()
    and status <> 'aprovado'
    and not exists (
      select 1 from public.contracted_events event_row
      where event_row.quote_id = quotes.id
    )
  );

create or replace function public.delete_quote_from_lead(p_lead_id uuid, p_quote_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare quote_row public.quotes%rowtype;
begin
  if not public.can_manage_quotes() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select * into quote_row
  from public.quotes
  where id = p_quote_id and lead_id = p_lead_id
  for update;
  if not found then
    raise exception 'quote not found for lead' using errcode = 'P0002';
  end if;
  if quote_row.status = 'aprovado' then
    raise exception 'approved quote cannot be deleted' using errcode = '55000';
  end if;
  if exists (select 1 from public.contracted_events where quote_id = p_quote_id) then
    raise exception 'quote is linked to a contracted event' using errcode = '55000';
  end if;

  insert into public.lead_history (lead_id, actor_id, action, metadata)
  values (
    p_lead_id,
    auth.uid(),
    'Orçamento excluído',
    jsonb_build_object('quote_id', quote_row.id, 'title', quote_row.title, 'status', quote_row.status)
  );

  delete from public.quotes where id = p_quote_id and lead_id = p_lead_id;
end;
$$;

revoke all on function public.delete_quote_from_lead(uuid, uuid) from public;
grant execute on function public.delete_quote_from_lead(uuid, uuid) to authenticated;
