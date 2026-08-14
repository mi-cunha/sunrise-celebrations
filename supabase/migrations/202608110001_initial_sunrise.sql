-- Sunrise OS: initial internal single-organisation model. Run in Supabase SQL editor or CLI.
create type public.app_permission as enum ('atendimento', 'financeiro', 'gerencia', 'admin_owner');
create type public.lead_status as enum ('novo', 'em_atendimento', 'qualificado', 'orcamento_em_elaboracao', 'proposta_enviada', 'negociacao', 'ganho', 'perdido');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null default 'Usuário',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.user_permissions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission public.app_permission not null,
  primary key (user_id, permission)
);
create table public.leads (
  id uuid primary key default gen_random_uuid(), name text not null check (char_length(name) between 2 and 120), company text check (company is null or char_length(company) <= 120), phone text not null check (char_length(phone) between 8 and 30),
  source text, event_type text, desired_date date, guest_count integer check (guest_count is null or guest_count > 0), notes text,
  status public.lead_status not null default 'novo', responsible_id uuid references public.profiles(id) on delete set null, created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.potential_events (
  id uuid primary key default gen_random_uuid(), lead_id uuid not null unique references public.leads(id) on delete cascade,
  event_type text, desired_date date, guest_count integer check (guest_count is null or guest_count > 0), created_at timestamptz not null default now()
);
create table public.lead_history (
  id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.leads(id) on delete cascade, actor_id uuid references public.profiles(id) on delete set null,
  action text not null, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

alter table public.profiles enable row level security; alter table public.user_permissions enable row level security; alter table public.leads enable row level security; alter table public.potential_events enable row level security; alter table public.lead_history enable row level security;
create function public.has_permission(required public.app_permission) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.profiles p join public.user_permissions up on up.user_id = p.id where p.id = auth.uid() and p.is_active and (up.permission = required or up.permission = 'admin_owner')) $$;
create function public.is_active_user() returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.profiles where id = auth.uid() and is_active) $$;
grant execute on function public.has_permission(public.app_permission), public.is_active_user() to authenticated;

create policy "profiles self or owner select" on public.profiles for select to authenticated using (id = auth.uid() or public.has_permission('admin_owner'));
create policy "permissions self or owner select" on public.user_permissions for select to authenticated using (user_id = auth.uid() or public.has_permission('admin_owner'));
create policy "lead readers" on public.leads for select to authenticated using (public.is_active_user());
create policy "lead managers create" on public.leads for insert to authenticated with check (public.has_permission('atendimento') and created_by = auth.uid() and (responsible_id is null or responsible_id = auth.uid() or public.has_permission('admin_owner')));
create policy "lead managers update" on public.leads for update to authenticated using (public.has_permission('atendimento')) with check (public.has_permission('atendimento'));
create policy "event readers" on public.potential_events for select to authenticated using (public.is_active_user());
create policy "lead managers create events" on public.potential_events for insert to authenticated with check (public.has_permission('atendimento') and exists (select 1 from public.leads l where l.id = lead_id and l.created_by = auth.uid()));
create policy "history readers" on public.lead_history for select to authenticated using (public.is_active_user());

-- A única escrita da fatia é atômica: lead, evento potencial e histórico existem juntos ou não existem.
create function public.create_lead_with_event(p_name text, p_company text, p_phone text, p_source text, p_event_type text, p_desired_date date, p_guest_count integer, p_notes text, p_responsible_id uuid, p_create_event boolean) returns uuid language plpgsql security invoker set search_path = public as $$
declare new_lead_id uuid;
begin
  insert into public.leads (name, company, phone, source, event_type, desired_date, guest_count, notes, responsible_id, created_by)
  values (p_name, p_company, p_phone, p_source, p_event_type, p_desired_date, p_guest_count, p_notes, p_responsible_id, auth.uid()) returning id into new_lead_id;
  if p_create_event then insert into public.potential_events (lead_id, event_type, desired_date, guest_count) values (new_lead_id, p_event_type, p_desired_date, p_guest_count); end if;
  return new_lead_id;
end; $$;
grant execute on function public.create_lead_with_event(text, text, text, text, text, date, integer, text, uuid, boolean) to authenticated;

create function public.record_lead_created() returns trigger language plpgsql security definer set search_path = public as $$ begin insert into public.lead_history (lead_id, actor_id, action, metadata) values (new.id, auth.uid(), 'Lead criado', jsonb_build_object('status', new.status)); return new; end; $$;
create trigger leads_created_history after insert on public.leads for each row execute function public.record_lead_created();
create function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger leads_touch_updated_at before update on public.leads for each row execute function public.touch_updated_at();
