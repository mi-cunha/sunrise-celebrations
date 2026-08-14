create function public.update_option_catalog_option(
  p_option_id uuid,
  p_name text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('admin_owner') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  update public.option_catalog
  set name = trim(p_name)
  where id = p_option_id;

  if not found then
    raise exception 'option not found' using errcode = 'P0002';
  end if;
end;
$$;

create function public.remove_option_catalog_option(p_option_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('admin_owner') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  delete from public.option_catalog
  where id = p_option_id;

  if not found then
    raise exception 'option not found' using errcode = 'P0002';
  end if;
end;
$$;

create function public.update_proposal_catalog_option(
  p_option_id uuid,
  p_title text,
  p_content text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('admin_owner') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  update public.proposal_option_catalog
  set
    title = trim(p_title),
    content = trim(p_content)
  where id = p_option_id;

  if not found then
    raise exception 'proposal option not found' using errcode = 'P0002';
  end if;
end;
$$;

create function public.remove_proposal_catalog_option(p_option_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('admin_owner') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  delete from public.proposal_option_catalog
  where id = p_option_id;

  if not found then
    raise exception 'proposal option not found' using errcode = 'P0002';
  end if;
end;
$$;

create function public.update_quote_item_catalog_option(
  p_option_id uuid,
  p_name text,
  p_description text,
  p_default_unit_price_cents integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('admin_owner') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  update public.quote_item_catalog
  set
    name = trim(p_name),
    description = nullif(trim(p_description), ''),
    default_unit_price_cents = p_default_unit_price_cents
  where id = p_option_id;

  if not found then
    raise exception 'quote item option not found' using errcode = 'P0002';
  end if;
end;
$$;

create function public.remove_quote_item_catalog_option(p_option_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('admin_owner') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  delete from public.quote_item_catalog
  where id = p_option_id;

  if not found then
    raise exception 'quote item option not found' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function public.update_option_catalog_option(uuid, text) to authenticated;
grant execute on function public.remove_option_catalog_option(uuid) to authenticated;
grant execute on function public.update_proposal_catalog_option(uuid, text, text) to authenticated;
grant execute on function public.remove_proposal_catalog_option(uuid) to authenticated;
grant execute on function public.update_quote_item_catalog_option(uuid, text, text, integer) to authenticated;
grant execute on function public.remove_quote_item_catalog_option(uuid) to authenticated;
