-- EIXU Sites: schema do gerador multi-tenant.
-- Idempotente: pode rodar novamente sem quebrar.

create extension if not exists pgcrypto;

create table if not exists tenants (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  status        text not null default 'draft',
  brief         jsonb not null default '{}'::jsonb,
  brand         jsonb not null default '{}'::jsonb,
  dials         jsonb not null default '{"variance":7,"motion":5,"density":4}'::jsonb,
  whatsapp      text,
  contact_email text,
  ga4_id        text,
  meta_pixel_id text,
  locale        text not null default 'pt-BR',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists pages (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  slug             text not null default '',
  type             text not null default 'page',
  title            text not null,
  seo              jsonb not null default '{}'::jsonb,
  meta             jsonb not null default '{}'::jsonb,
  blocks           jsonb not null default '[]'::jsonb,
  published_blocks jsonb,
  published_seo    jsonb,
  published_at     timestamptz,
  nav_order        int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (tenant_id, slug)
);

create table if not exists leads (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  page_id    uuid references pages(id) on delete set null,
  name       text,
  email      text,
  phone      text,
  fields     jsonb not null default '{}'::jsonb,
  source     jsonb not null default '{}'::jsonb,
  consent    jsonb not null default '{}'::jsonb,
  status     text not null default 'new',
  note       text,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id         bigserial primary key,
  tenant_id  uuid not null references tenants(id) on delete cascade,
  type       text not null,
  path       text,
  session_id text,
  source     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists campaign_spend (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  campaign     text not null,
  channel      text not null default 'google',
  spend_cents  bigint not null default 0,
  period_start date not null,
  period_end   date not null,
  created_at   timestamptz not null default now()
);

create table if not exists chat_messages (
  id         bigserial primary key,
  tenant_id  uuid not null references tenants(id) on delete cascade,
  role       text not null,
  content    text not null,
  created_at timestamptz not null default now()
);

create index if not exists pages_tenant_idx        on pages (tenant_id);
create index if not exists leads_tenant_time_idx   on leads (tenant_id, created_at desc);
create index if not exists events_tenant_time_idx  on events (tenant_id, created_at desc);
create index if not exists events_tenant_type_idx  on events (tenant_id, type);
create index if not exists chat_tenant_time_idx    on chat_messages (tenant_id, created_at);
create index if not exists spend_tenant_idx        on campaign_spend (tenant_id);
