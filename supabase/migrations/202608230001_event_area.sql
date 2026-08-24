alter table public.quotes
  add column if not exists event_area text
  check (event_area is null or event_area in ('lado_esquerdo', 'lado_direito', 'praia', 'casa_completa'));

alter table public.contracted_events
  add column if not exists event_area text
  check (event_area is null or event_area in ('lado_esquerdo', 'lado_direito', 'praia', 'casa_completa'));

create or replace function public.copy_quote_event_area_to_contracted_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.quote_id is not null and new.event_area is null then
    select q.event_area into new.event_area
    from public.quotes q
    where q.id = new.quote_id;
  end if;
  return new;
end;
$$;

drop trigger if exists contracted_events_copy_event_area on public.contracted_events;
create trigger contracted_events_copy_event_area
before insert or update of quote_id on public.contracted_events
for each row execute function public.copy_quote_event_area_to_contracted_event();

create or replace function public.sync_quote_event_area_to_contracted_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.contracted_events
  set event_area = new.event_area
  where quote_id = new.id;
  return new;
end;
$$;

drop trigger if exists quotes_sync_event_area on public.quotes;
create trigger quotes_sync_event_area
after update of event_area on public.quotes
for each row execute function public.sync_quote_event_area_to_contracted_event();

update public.contracted_events ce
set event_area = q.event_area
from public.quotes q
where ce.quote_id = q.id
  and ce.event_area is null
  and q.event_area is not null;
