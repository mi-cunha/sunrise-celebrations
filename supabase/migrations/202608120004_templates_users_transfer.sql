-- Fase 1: templates de resposta e gestão básica de usuários.
create table public.response_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 120),
  body text not null check (char_length(body) between 1 and 2000),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index response_templates_title_idx on public.response_templates (lower(title));

alter table public.response_templates enable row level security;

create policy "active users read response templates" on public.response_templates
  for select to authenticated using (public.is_active_user() and is_active);

create policy "owners manage response templates" on public.response_templates
  for all to authenticated using (public.has_permission('admin_owner')) with check (public.has_permission('admin_owner'));

insert into public.response_templates (title, body, sort_order) values
('Solicitar data e convidados', 'Perfeito! Para eu avançar por aqui, você consegue me confirmar a data desejada e a quantidade estimada de convidados?', 10),
('Solicitar detalhes do evento', 'Obrigada pelas informações. Você pode me contar um pouco mais sobre o tipo de evento, horário previsto e perfil dos convidados?', 20),
('Aviso de retorno humano', 'Recebi sua mensagem e vou verificar com a equipe responsável. Retorno assim que tiver uma posição segura para te passar.', 30),
('Encaminhar proposta', 'Combinado. Vou organizar as informações para seguirmos com orçamento/proposta e te retorno com os próximos passos.', 40)
on conflict do nothing;

create function public.admin_update_user_access(
  p_user_id uuid,
  p_display_name text,
  p_is_active boolean,
  p_permissions public.app_permission[]
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('admin_owner') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if p_user_id = auth.uid() and not ('admin_owner' = any(p_permissions)) then
    raise exception 'admin cannot remove own owner permission' using errcode = '42501';
  end if;

  insert into public.profiles (id, display_name, is_active)
  values (p_user_id, p_display_name, p_is_active)
  on conflict (id) do update
  set display_name = excluded.display_name,
      is_active = excluded.is_active;

  delete from public.user_permissions where user_id = p_user_id;

  insert into public.user_permissions (user_id, permission)
  select p_user_id, permission
  from unnest(p_permissions) as permission;
end;
$$;

grant execute on function public.admin_update_user_access(uuid, text, boolean, public.app_permission[]) to authenticated;
