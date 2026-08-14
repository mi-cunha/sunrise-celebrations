-- Fase 3: ajustes no catálogo de pacotes.
alter table public.event_package_items
  drop constraint if exists event_package_items_category_check;

update public.event_package_items
set category = 'buffet'
where category = 'comida';

alter table public.event_package_items
  add constraint event_package_items_category_check
  check (category in ('buffet', 'bebida', 'servico', 'estrutura', 'observacao', 'outro'));
