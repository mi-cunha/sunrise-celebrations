-- Atendimento administra o catálogo comercial sem ganhar acesso às demais configurações.
create or replace function public.can_manage_package_catalog() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_permission('atendimento') or public.has_permission('gerencia') or public.has_permission('direcao') or public.has_permission('admin_owner');
$$;
grant execute on function public.can_manage_package_catalog() to authenticated;

create policy "package managers create packages" on public.event_package_catalog for insert to authenticated with check (public.can_manage_package_catalog());
create policy "package managers update packages" on public.event_package_catalog for update to authenticated using (public.can_manage_package_catalog()) with check (public.can_manage_package_catalog());
create policy "package managers create package items" on public.event_package_items for insert to authenticated with check (public.can_manage_package_catalog());
create policy "package managers update package items" on public.event_package_items for update to authenticated using (public.can_manage_package_catalog()) with check (public.can_manage_package_catalog());
create policy "package managers create subcategories" on public.event_package_subcategories for insert to authenticated with check (public.can_manage_package_catalog());
create policy "package managers update subcategories" on public.event_package_subcategories for update to authenticated using (public.can_manage_package_catalog()) with check (public.can_manage_package_catalog());
create policy "package managers create library items" on public.event_package_item_catalog for insert to authenticated with check (public.can_manage_package_catalog());
create policy "package managers update library items" on public.event_package_item_catalog for update to authenticated using (public.can_manage_package_catalog()) with check (public.can_manage_package_catalog());
create policy "package managers create rules" on public.event_package_rules for insert to authenticated with check (public.can_manage_package_catalog());
create policy "package managers create rule items" on public.event_package_rule_items for insert to authenticated with check (public.can_manage_package_catalog());
