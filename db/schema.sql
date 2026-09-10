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

-- Imagens geradas pelo módulo de imagens. Ficam no Vercel Blob; aqui vive o
-- metadado, a crítica e o estado de aprovação.
create table if not exists images (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  seq            int not null,
  batch_id       uuid not null,
  request_text   text not null,
  target_block   text,
  ratio          text not null,
  width          int,
  height         int,
  model          text not null,
  prompt_final   text not null,
  url            text not null,
  blob_path      text not null,
  status         text not null default 'candidata',
  score          numeric(3,1),
  critique       jsonb not null default '{}'::jsonb,
  alt            text,
  description    text,
  reference_urls jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),
  unique (tenant_id, seq)
);

-- Colunas acrescentadas depois da primeira versão do schema.
alter table tenants       add column if not exists image_guide jsonb not null default '{}'::jsonb;
alter table chat_messages add column if not exists channel text not null default 'site';
-- 'foto' ou 'logo'. Coluna própria porque target_block é enum de blocos do site.
alter table images        add column if not exists kind text not null default 'foto';

create index if not exists pages_tenant_idx        on pages (tenant_id);
create index if not exists images_tenant_time_idx  on images (tenant_id, created_at desc);
create index if not exists images_batch_idx        on images (batch_id);
create index if not exists leads_tenant_time_idx   on leads (tenant_id, created_at desc);
create index if not exists events_tenant_time_idx  on events (tenant_id, created_at desc);
create index if not exists events_tenant_type_idx  on events (tenant_id, type);
create index if not exists chat_tenant_time_idx    on chat_messages (tenant_id, created_at);
create index if not exists spend_tenant_idx        on campaign_spend (tenant_id);
