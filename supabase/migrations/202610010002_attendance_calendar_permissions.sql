-- Atendimento pode operar a agenda: incluir, editar e remover compromissos internos.
-- A política continua exigindo usuário ativo e preserva os controles financeiros separados.

drop policy if exists "calendar managers insert entries" on public.calendar_entries;
drop policy if exists "calendar managers update entries" on public.calendar_entries;
drop policy if exists "calendar managers delete entries" on public.calendar_entries;

create policy "calendar operators insert entries" on public.calendar_entries
  for insert to authenticated
  with check (
    (
      public.has_permission('atendimento')
      or public.has_permission('gerencia')
      or public.has_permission('direcao')
      or public.has_permission('admin_owner')
    )
    and created_by = auth.uid()
  );

create policy "calendar operators update entries" on public.calendar_entries
  for update to authenticated
  using (
    public.has_permission('atendimento')
    or public.has_permission('gerencia')
    or public.has_permission('direcao')
    or public.has_permission('admin_owner')
  )
  with check (
    public.has_permission('atendimento')
    or public.has_permission('gerencia')
    or public.has_permission('direcao')
    or public.has_permission('admin_owner')
  );

create policy "calendar operators delete entries" on public.calendar_entries
  for delete to authenticated
  using (
    public.has_permission('atendimento')
    or public.has_permission('gerencia')
    or public.has_permission('direcao')
    or public.has_permission('admin_owner')
  );
