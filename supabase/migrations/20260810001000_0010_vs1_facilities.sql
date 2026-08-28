-- VS-1A public facility master.
-- Source-only migration: do not apply remotely without target and recovery verification.

create extension if not exists pg_trgm with schema extensions;

create table if not exists public.facilities (
  mgt_no text primary key,
  name text not null,
  biz_type text,
  status text not null,
  region_sido text,
  region_sigungu text,
  road_addr text,
  tel text,
  is_haccp boolean not null default false,
  suspension_count integer not null default 0 check (suspension_count >= 0),
  coord_x double precision,
  coord_y double precision,
  updated_at timestamptz,
  source_snapshot_id text,
  created_at timestamptz not null default now()
);

comment on table public.facilities is
  'Public-safe facility search master for the isolated Foodground official project.';

create index if not exists facilities_name_mgt_no_idx
  on public.facilities (name asc, mgt_no asc);

create index if not exists facilities_region_name_idx
  on public.facilities (region_sido, region_sigungu, name, mgt_no);

create index if not exists facilities_biz_type_name_idx
  on public.facilities (biz_type, name, mgt_no);

create index if not exists facilities_name_trgm_idx
  on public.facilities using gin (name extensions.gin_trgm_ops);

create index if not exists facilities_road_addr_trgm_idx
  on public.facilities using gin (road_addr extensions.gin_trgm_ops)
  where road_addr is not null;

alter table public.facilities enable row level security;

drop policy if exists "facilities_public_read" on public.facilities;
create policy "facilities_public_read"
  on public.facilities
  for select
  to anon, authenticated
  using (true);

revoke all on table public.facilities from anon, authenticated;
grant select on table public.facilities to anon, authenticated;
