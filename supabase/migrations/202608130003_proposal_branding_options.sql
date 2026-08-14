create table public.company_settings (
  id boolean primary key default true check (id),
  logo_url text check (logo_url is null or char_length(trim(logo_url)) <= 1000),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.company_settings (id)
values (true)
on conflict (id) do nothing;

create table public.proposal_option_catalog (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 120),
  content text not null check (char_length(trim(content)) between 2 and 1200),
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create unique index proposal_option_catalog_title_idx on public.proposal_option_catalog (lower(title));

create table public.quote_proposal_options (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  catalog_option_id uuid references public.proposal_option_catalog(id) on delete set null,
  title text not null check (char_length(trim(title)) between 2 and 120),
  content text not null check (char_length(trim(content)) between 2 and 1200),
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create index quote_proposal_options_quote_sort_idx on public.quote_proposal_options (quote_id, sort_order, created_at);

alter table public.company_settings enable row level security;
alter table public.proposal_option_catalog enable row level security;
alter table public.quote_proposal_options enable row level security;

create policy "active users read company settings" on public.company_settings
  for select to authenticated using (public.is_active_user());
create policy "owners update company settings" on public.company_settings
  for update to authenticated using (public.has_permission('admin_owner')) with check (public.has_permission('admin_owner'));

create policy "active users read proposal options" on public.proposal_option_catalog
  for select to authenticated using (public.is_active_user());
create policy "owners insert proposal options" on public.proposal_option_catalog
  for insert to authenticated with check (public.has_permission('admin_owner'));
create policy "owners update proposal options" on public.proposal_option_catalog
  for update to authenticated using (public.has_permission('admin_owner')) with check (public.has_permission('admin_owner'));

create policy "active users read quote proposal options" on public.quote_proposal_options
  for select to authenticated using (public.is_active_user());
create policy "quote managers insert quote proposal options" on public.quote_proposal_options
  for insert to authenticated with check (public.can_manage_quotes());
create policy "quote managers update quote proposal options" on public.quote_proposal_options
  for update to authenticated using (public.can_manage_quotes()) with check (public.can_manage_quotes());
create policy "quote managers delete quote proposal options" on public.quote_proposal_options
  for delete to authenticated using (public.can_manage_quotes());

create trigger company_settings_touch_updated_at
  before update on public.company_settings
  for each row execute function public.touch_updated_at();

create function public.set_company_logo(p_logo_url text) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('admin_owner') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  insert into public.company_settings (id, logo_url, updated_by)
  values (true, nullif(trim(p_logo_url), ''), auth.uid())
  on conflict (id) do update
    set logo_url = excluded.logo_url,
        updated_by = auth.uid();
end;
$$;

create function public.add_proposal_catalog_option(
  p_title text,
  p_content text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_option_id uuid;
begin
  if not public.has_permission('admin_owner') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  insert into public.proposal_option_catalog (title, content)
  values (trim(p_title), trim(p_content))
  returning id into new_option_id;

  return new_option_id;
end;
$$;

create function public.add_quote_proposal_option(
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
  if not public.can_manage_quotes() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if not exists (select 1 from public.quotes where id = p_quote_id) then
    raise exception 'quote not found' using errcode = 'P0002';
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

create function public.remove_quote_proposal_option(p_option_id uuid) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_quote_id uuid;
  removed_title text;
begin
  if not public.can_manage_quotes() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select quote_id, title
  into target_quote_id, removed_title
  from public.quote_proposal_options
  where id = p_option_id;

  if target_quote_id is null then
    raise exception 'proposal option not found' using errcode = 'P0002';
  end if;

  delete from public.quote_proposal_options
  where id = p_option_id;

  insert into public.quote_history (quote_id, actor_id, action, metadata)
  values (target_quote_id, auth.uid(), 'Opção removida da proposta', jsonb_build_object('option_id', p_option_id, 'title', removed_title));

  return target_quote_id;
end;
$$;

grant execute on function public.set_company_logo(text) to authenticated;
grant execute on function public.add_proposal_catalog_option(text, text) to authenticated;
grant execute on function public.add_quote_proposal_option(uuid, uuid, text, text) to authenticated;
grant execute on function public.remove_quote_proposal_option(uuid) to authenticated;
