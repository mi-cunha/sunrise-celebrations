-- Isolated review demo audit and durable at-most-once claim. No customer data.
begin;
create table public.whatsapp_review_operations (
  id uuid primary key,
  actor_id uuid not null references public.profiles(id),
  kind text not null check (kind in ('send', 'template')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'unconfirmed')),
  meta_id text,
  created_at timestamptz not null default now()
);
alter table public.whatsapp_review_operations enable row level security;
revoke all on public.whatsapp_review_operations from anon, authenticated;
grant select, insert, update on public.whatsapp_review_operations to service_role;
commit;
