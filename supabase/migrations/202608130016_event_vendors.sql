-- Fase 3: fornecedores do evento.
create type public.contracted_event_vendor_status as enum ('pendente', 'confirmado', 'substituir', 'cancelado');

create table public.contracted_event_vendors (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.contracted_events(id) on delete cascade,
  category text not null check (char_length(category) between 2 and 80),
  name text not null check (char_length(name) between 2 and 160),
  contact_name text check (contact_name is null or char_length(contact_name) <= 160),
  phone text check (phone is null or char_length(phone) <= 40),
  email text check (email is null or char_length(email) <= 160),
  status public.contracted_event_vendor_status not null default 'pendente',
  notes text check (notes is null or char_length(notes) <= 1200),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contracted_event_vendors_event_status_idx on public.contracted_event_vendors (event_id, status, category);

alter table public.contracted_event_vendors enable row level security;

create policy "active users read contracted event vendors" on public.contracted_event_vendors
  for select to authenticated using (public.is_active_user());
create policy "event managers create contracted event vendors" on public.contracted_event_vendors
  for insert to authenticated with check (public.can_manage_contracted_events() and created_by = auth.uid());
create policy "event managers update contracted event vendors" on public.contracted_event_vendors
  for update to authenticated using (public.can_manage_contracted_events()) with check (public.can_manage_contracted_events());
create policy "event managers delete contracted event vendors" on public.contracted_event_vendors
  for delete to authenticated using (public.can_manage_contracted_events());

create trigger contracted_event_vendors_touch_updated_at
  before update on public.contracted_event_vendors
  for each row execute function public.touch_updated_at();

create function public.add_contracted_event_vendor(
  p_event_id uuid,
  p_category text,
  p_name text,
  p_contact_name text default null,
  p_phone text default null,
  p_email text default null,
  p_status public.contracted_event_vendor_status default 'pendente',
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_vendor_id uuid;
  normalized_category text;
  normalized_name text;
  normalized_contact_name text;
  normalized_phone text;
  normalized_email text;
  normalized_notes text;
begin
  if not public.can_manage_contracted_events() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if not exists (select 1 from public.contracted_events where id = p_event_id) then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  normalized_category := trim(p_category);
  normalized_name := trim(p_name);
  normalized_contact_name := nullif(trim(coalesce(p_contact_name, '')), '');
  normalized_phone := nullif(trim(coalesce(p_phone, '')), '');
  normalized_email := nullif(trim(coalesce(p_email, '')), '');
  normalized_notes := nullif(trim(coalesce(p_notes, '')), '');

  if char_length(normalized_category) < 2 or char_length(normalized_name) < 2 then
    raise exception 'vendor category and name are required' using errcode = '22023';
  end if;

  insert into public.contracted_event_vendors (
    event_id,
    category,
    name,
    contact_name,
    phone,
    email,
    status,
    notes,
    created_by
  ) values (
    p_event_id,
    normalized_category,
    normalized_name,
    normalized_contact_name,
    normalized_phone,
    normalized_email,
    p_status,
    normalized_notes,
    auth.uid()
  )
  returning id into new_vendor_id;

  insert into public.contracted_event_history (event_id, actor_id, action, metadata)
  values (p_event_id, auth.uid(), 'Fornecedor adicionado', jsonb_build_object('vendor_id', new_vendor_id, 'name', normalized_name, 'category', normalized_category));

  return new_vendor_id;
end;
$$;

create function public.update_contracted_event_vendor(
  p_vendor_id uuid,
  p_category text,
  p_name text,
  p_contact_name text default null,
  p_phone text default null,
  p_email text default null,
  p_status public.contracted_event_vendor_status default 'pendente',
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event_id uuid;
  normalized_category text;
  normalized_name text;
  normalized_contact_name text;
  normalized_phone text;
  normalized_email text;
  normalized_notes text;
begin
  if not public.can_manage_contracted_events() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select event_id
  into target_event_id
  from public.contracted_event_vendors
  where id = p_vendor_id;

  if target_event_id is null then
    raise exception 'vendor not found' using errcode = 'P0002';
  end if;

  normalized_category := trim(p_category);
  normalized_name := trim(p_name);
  normalized_contact_name := nullif(trim(coalesce(p_contact_name, '')), '');
  normalized_phone := nullif(trim(coalesce(p_phone, '')), '');
  normalized_email := nullif(trim(coalesce(p_email, '')), '');
  normalized_notes := nullif(trim(coalesce(p_notes, '')), '');

  if char_length(normalized_category) < 2 or char_length(normalized_name) < 2 then
    raise exception 'vendor category and name are required' using errcode = '22023';
  end if;

  update public.contracted_event_vendors
  set
    category = normalized_category,
    name = normalized_name,
    contact_name = normalized_contact_name,
    phone = normalized_phone,
    email = normalized_email,
    status = p_status,
    notes = normalized_notes
  where id = p_vendor_id;

  insert into public.contracted_event_history (event_id, actor_id, action, metadata)
  values (target_event_id, auth.uid(), 'Fornecedor atualizado', jsonb_build_object('vendor_id', p_vendor_id, 'name', normalized_name, 'category', normalized_category, 'status', p_status));

  return target_event_id;
end;
$$;

create function public.remove_contracted_event_vendor(p_vendor_id uuid) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event_id uuid;
  removed_name text;
begin
  if not public.can_manage_contracted_events() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select event_id, name
  into target_event_id, removed_name
  from public.contracted_event_vendors
  where id = p_vendor_id;

  if target_event_id is null then
    raise exception 'vendor not found' using errcode = 'P0002';
  end if;

  delete from public.contracted_event_vendors
  where id = p_vendor_id;

  insert into public.contracted_event_history (event_id, actor_id, action, metadata)
  values (target_event_id, auth.uid(), 'Fornecedor removido', jsonb_build_object('vendor_id', p_vendor_id, 'name', removed_name));

  return target_event_id;
end;
$$;

grant execute on function public.add_contracted_event_vendor(uuid, text, text, text, text, text, public.contracted_event_vendor_status, text) to authenticated;
grant execute on function public.update_contracted_event_vendor(uuid, text, text, text, text, text, public.contracted_event_vendor_status, text) to authenticated;
grant execute on function public.remove_contracted_event_vendor(uuid) to authenticated;
