create extension if not exists pg_cron;
create extension if not exists pg_net;
create table if not exists public.worker_auth (id boolean primary key default true check (id), token text not null);
grant all on public.worker_auth to service_role;
alter table public.worker_auth enable row level security;
insert into public.worker_auth (id, token) values (true, encode(extensions.gen_random_bytes(24),'hex')) on conflict (id) do nothing;