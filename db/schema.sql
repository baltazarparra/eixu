-- EIXU Studio: plataforma de gestão, chat durável e projetos independentes.
-- Idempotente e aditivo para bancos existentes. A retirada física das tabelas
-- do gerador antigo pertence ao reset controlado, não a esta migração diária.

create extension if not exists pgcrypto;

create table if not exists platform_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
insert into platform_settings (key, value)
values ('sites_maintenance', 'false'::jsonb)
on conflict (key) do nothing;

create table if not exists site_folders (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists site_folders_name_unique_idx
  on site_folders (lower(btrim(name)));

create table if not exists tenants (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name          text not null,
  status        text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  brief         jsonb not null default '{}'::jsonb,
  brand         jsonb not null default '{}'::jsonb,
  contacts      jsonb not null default '{}'::jsonb,
  whatsapp      text,
  contact_email text,
  ga4_id        text,
  meta_pixel_id text,
  locale        text not null default 'pt-BR',
  folder_id     uuid references site_folders(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table tenants add column if not exists contacts jsonb not null default '{}'::jsonb;
alter table tenants add column if not exists folder_id uuid references site_folders(id) on delete set null;
create index if not exists tenants_folder_idx on tenants (folder_id);

create table if not exists admin_users (
  id         uuid primary key default gen_random_uuid(),
  login      text not null unique check (login = lower(btrim(login))),
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  pin_hash   text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_sessions (
  token_hash text primary key,
  user_id    uuid not null references admin_users(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists admin_sessions_user_idx
  on admin_sessions (user_id, expires_at desc);
create index if not exists admin_sessions_expiry_idx
  on admin_sessions (expires_at);

create table if not exists admin_login_attempts (
  login             text primary key,
  failures          integer not null default 0,
  window_started_at timestamptz not null default now(),
  blocked_until     timestamptz,
  updated_at        timestamptz not null default now()
);

create table if not exists leads (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  page_path  text,
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
alter table leads add column if not exists page_path text;
create index if not exists leads_tenant_time_idx
  on leads (tenant_id, created_at desc);

create table if not exists events (
  id         bigserial primary key,
  tenant_id  uuid not null references tenants(id) on delete cascade,
  type       text not null,
  path       text,
  session_id text,
  source     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists events_tenant_time_idx
  on events (tenant_id, created_at desc);
create index if not exists events_tenant_type_idx on events (tenant_id, type);

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
create index if not exists spend_tenant_idx on campaign_spend (tenant_id);

create table if not exists images (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  seq            integer not null,
  batch_id       uuid not null,
  studio_request_key text,
  request_text   text not null,
  target_block   text,
  ratio          text not null,
  width          integer,
  height         integer,
  model          text not null,
  prompt_final   text not null,
  url            text not null,
  blob_path      text not null,
  kind           text not null default 'foto'
    check (kind in ('foto', 'logo')),
  status         text not null default 'disponivel'
    check (status in ('disponivel', 'candidata', 'aprovada', 'rejeitada')),
  score          numeric(3,1),
  critique       jsonb not null default '{}'::jsonb,
  alt            text,
  description    text,
  reference_urls jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),
  unique (tenant_id, seq)
);
alter table images add column if not exists kind text not null default 'foto';
alter table images add column if not exists studio_request_key text;
create index if not exists images_tenant_time_idx
  on images (tenant_id, created_at desc);
create index if not exists images_batch_idx on images (batch_id);
drop index if exists images_tenant_batch_idx;
create unique index if not exists images_studio_request_idx
  on images (tenant_id, studio_request_key)
  where studio_request_key is not null;

create table if not exists studio_projects (
  id                         uuid primary key default gen_random_uuid(),
  tenant_id                  uuid not null unique references tenants(id) on delete cascade,
  slug                       text not null unique
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status                     text not null default 'draft'
    check (status in ('draft', 'building', 'ready', 'published', 'archived', 'failed')),
  sandbox_name               text not null unique,
  repository_path            text,
  vercel_project_id          text unique,
  vercel_project_name        text unique,
  canonical_host             text not null unique,
  base_code_revision         text,
  draft_code_revision        text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);
create index if not exists studio_projects_status_idx
  on studio_projects (status, updated_at desc);

create table if not exists studio_content_revisions (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references studio_projects(id) on delete cascade,
  revision       integer not null check (revision > 0),
  schema_version integer not null default 1 check (schema_version > 0),
  contract_hash  text not null check (contract_hash ~ '^[0-9a-f]{64}$'),
  contract       jsonb not null check (jsonb_typeof(contract) = 'object'),
  content        jsonb not null check (jsonb_typeof(content) = 'object'),
  source         text not null default 'chat'
    check (source in ('chat', 'cms', 'release', 'rollback', 'migration')),
  summary        text,
  created_by     uuid references admin_users(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (project_id, revision)
);
create index if not exists studio_content_project_time_idx
  on studio_content_revisions (project_id, created_at desc);

create table if not exists studio_releases (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references studio_projects(id) on delete cascade,
  code_revision       text not null,
  code_artifact_key   text not null,
  content_revision_id uuid not null references studio_content_revisions(id) on delete restrict,
  contract_hash       text not null check (contract_hash ~ '^[0-9a-f]{64}$'),
  deployment_id       text unique,
  deployment_url      text,
  workflow_run_id     text unique,
  status              text not null default 'preparing'
    check (status in ('preparing', 'validating', 'ready', 'active', 'failed', 'rolled_back')),
  manifest            jsonb not null default '{}'::jsonb,
  error               text,
  requested_by        uuid references admin_users(id) on delete set null,
  activated_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table studio_releases add column if not exists workflow_run_id text;
alter table studio_releases add column if not exists error text;
alter table studio_releases add column if not exists updated_at timestamptz not null default now();
create index if not exists studio_releases_project_time_idx
  on studio_releases (project_id, created_at desc);
create unique index if not exists studio_releases_workflow_idx
  on studio_releases (workflow_run_id) where workflow_run_id is not null;
create unique index if not exists studio_releases_inflight_project_idx
  on studio_releases (project_id)
  where status in ('preparing', 'validating', 'ready');

alter table studio_projects add column if not exists active_release_id uuid
  references studio_releases(id) on delete set null;
alter table studio_projects add column if not exists active_content_revision_id uuid
  references studio_content_revisions(id) on delete set null;

create table if not exists studio_runs (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references studio_projects(id) on delete cascade,
  tenant_id             uuid not null references tenants(id) on delete cascade,
  workflow_run_id       text unique,
  request_message_uid   text not null,
  response_message_uid  text,
  kind                  text not null default 'chat'
    check (kind in ('chat', 'build', 'edit', 'refine', 'preview', 'publish')),
  status                text not null default 'queued'
    check (status in ('queued', 'running', 'cancel_requested', 'succeeded', 'failed', 'cancelled')),
  model_role            text not null default 'assistant',
  base_code_revision    text,
  base_content_revision integer,
  result                jsonb not null default '{}'::jsonb,
  error                 text,
  requested_by          uuid references admin_users(id) on delete set null,
  event_sequence        integer not null default 0 check (event_sequence >= 0),
  started_at            timestamptz,
  finished_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
alter table studio_runs add column if not exists event_sequence integer
  not null default 0 check (event_sequence >= 0);
create unique index if not exists studio_runs_active_project_idx
  on studio_runs (project_id)
  where status in ('queued', 'running', 'cancel_requested');
create unique index if not exists studio_runs_request_message_idx
  on studio_runs (tenant_id, request_message_uid);
create index if not exists studio_runs_project_time_idx
  on studio_runs (project_id, created_at desc);

create table if not exists studio_tool_leases (
  project_id uuid primary key references studio_projects(id) on delete cascade,
  run_id     uuid not null references studio_runs(id) on delete cascade,
  token      uuid not null,
  operation  text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists studio_events (
  id         bigserial primary key,
  run_id     uuid not null references studio_runs(id) on delete cascade,
  sequence   integer not null check (sequence >= 0),
  type       text not null,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, sequence)
);
create index if not exists studio_events_run_idx
  on studio_events (run_id, sequence);

create table if not exists studio_artifacts (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references studio_projects(id) on delete cascade,
  run_id       uuid references studio_runs(id) on delete set null,
  kind         text not null
    check (kind in ('context', 'art_direction', 'code', 'content_contract', 'screenshot', 'validation', 'release_manifest')),
  version      integer not null default 1 check (version > 0),
  input_hash   text check (input_hash is null or input_hash ~ '^[0-9a-f]{64}$'),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  payload      jsonb not null default '{}'::jsonb,
  storage_key  text,
  created_at   timestamptz not null default now(),
  unique (project_id, kind, version)
);
create index if not exists studio_artifacts_project_idx
  on studio_artifacts (project_id, kind, created_at desc);
create unique index if not exists studio_artifacts_run_kind_idx
  on studio_artifacts (run_id, kind) where run_id is not null;

create table if not exists studio_source_evidence (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references studio_projects(id) on delete cascade,
  artifact_id uuid references studio_artifacts(id) on delete set null,
  role        text not null
    check (role in ('official', 'visual_reference', 'operator', 'logo')),
  url         text,
  title       text,
  excerpt     text,
  identity    jsonb not null default '{}'::jsonb,
  status      text not null default 'observed'
    check (status in ('observed', 'confirmed', 'rejected', 'unavailable')),
  captured_at timestamptz not null default now()
);
create index if not exists studio_source_evidence_project_idx
  on studio_source_evidence (project_id, role, captured_at desc);

create table if not exists studio_preview_sessions (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references studio_projects(id) on delete cascade,
  token_hash          text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  code_revision       text not null,
  content_revision_id uuid references studio_content_revisions(id) on delete cascade,
  preview_url         text,
  created_by          uuid references admin_users(id) on delete set null,
  expires_at          timestamptz not null,
  created_at          timestamptz not null default now()
);
create index if not exists studio_preview_project_expiry_idx
  on studio_preview_sessions (project_id, expires_at desc);

create table if not exists chat_messages (
  id            bigserial primary key,
  tenant_id     uuid not null references tenants(id) on delete cascade,
  role          text not null,
  content       text not null default '',
  channel       text not null default 'site',
  admin_user_id uuid references admin_users(id) on delete set null,
  actor_type    text not null default 'legacy',
  actor_name    text,
  actor_login   text,
  message_uid   text,
  parts         jsonb,
  metadata      jsonb not null default '{}'::jsonb,
  studio_run_id uuid references studio_runs(id) on delete set null,
  created_at    timestamptz not null default now()
);
alter table chat_messages add column if not exists channel text not null default 'site';
alter table chat_messages add column if not exists admin_user_id uuid references admin_users(id) on delete set null;
alter table chat_messages add column if not exists actor_type text not null default 'legacy';
alter table chat_messages add column if not exists actor_name text;
alter table chat_messages add column if not exists actor_login text;
alter table chat_messages add column if not exists message_uid text;
alter table chat_messages add column if not exists parts jsonb;
alter table chat_messages add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table chat_messages add column if not exists studio_run_id uuid
  references studio_runs(id) on delete set null;
update chat_messages
set message_uid = 'legacy-' || id,
    parts = jsonb_build_array(jsonb_build_object('type', 'text', 'text', content))
where message_uid is null or parts is null;
alter table chat_messages alter column message_uid set not null;
alter table chat_messages alter column parts set not null;
create unique index if not exists chat_message_uid_idx
  on chat_messages (tenant_id, channel, message_uid);
create index if not exists chat_tenant_time_idx
  on chat_messages (tenant_id, created_at);
create index if not exists chat_studio_run_idx
  on chat_messages (studio_run_id) where studio_run_id is not null;

create table if not exists ai_usage (
  id                 bigserial primary key,
  tenant_id          uuid not null references tenants(id) on delete cascade,
  operation_id       text not null,
  step               integer not null check (step >= 0),
  kind               text not null,
  model              text not null,
  phase              text,
  studio_run_id      uuid references studio_runs(id) on delete set null,
  status             text not null default 'pending'
    check (status in ('pending', 'recorded', 'failed')),
  input_tokens       bigint check (input_tokens >= 0),
  output_tokens      bigint check (output_tokens >= 0),
  total_tokens       bigint check (total_tokens >= 0),
  cache_read_tokens  bigint check (cache_read_tokens >= 0),
  cache_write_tokens bigint check (cache_write_tokens >= 0),
  reasoning_tokens   bigint check (reasoning_tokens >= 0),
  cost_usd           numeric(20,10) check (cost_usd >= 0),
  source             text not null default 'gateway',
  lifecycle          text not null default 'studio',
  external_id        text,
  legacy             boolean not null default false,
  created_at         timestamptz not null default now(),
  finished_at        timestamptz,
  unique (tenant_id, operation_id, step)
);
alter table ai_usage add column if not exists studio_run_id uuid
  references studio_runs(id) on delete set null;
alter table ai_usage add column if not exists source text not null default 'gateway';
alter table ai_usage drop constraint if exists ai_usage_lifecycle_check;
alter table ai_usage add column if not exists lifecycle text not null default 'studio';
alter table ai_usage add constraint ai_usage_lifecycle_check
  check (lifecycle in ('unknown', 'generator', 'converting', 'premium', 'studio'));
alter table ai_usage add column if not exists external_id text;
create unique index if not exists ai_usage_external_receipt_idx
  on ai_usage (source, external_id) where external_id is not null;
create index if not exists ai_usage_tenant_time_idx
  on ai_usage (tenant_id, created_at desc, id desc);

create table if not exists admin_activity (
  id            bigserial primary key,
  user_id       uuid references admin_users(id) on delete set null,
  actor_type    text not null default 'user',
  actor_name    text,
  actor_login   text,
  tenant_id     uuid references tenants(id) on delete set null,
  tenant_slug   text,
  tenant_name   text,
  action        text not null,
  resource_type text,
  resource_id   text,
  result        text not null default 'success',
  summary       text not null,
  operation_id  text unique,
  detail        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists admin_activity_time_idx
  on admin_activity (created_at desc, id desc);
create index if not exists admin_activity_tenant_idx
  on admin_activity (tenant_id, created_at desc, id desc);
create index if not exists admin_activity_user_idx
  on admin_activity (user_id, created_at desc, id desc);

create table if not exists kanban_boards (
  id             uuid primary key default gen_random_uuid(),
  key            text not null unique,
  title          text not null,
  revision       bigint not null default 0 check (revision >= 0),
  schema_version integer not null default 2 check (schema_version > 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table kanban_boards add column if not exists schema_version integer
  not null default 2 check (schema_version > 0);

create table if not exists kanban_columns (
  id         uuid primary key,
  board_id   uuid not null references kanban_boards(id) on delete restrict,
  title      text not null check (char_length(btrim(title)) between 1 and 40),
  position   integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, position) deferrable initially deferred
);

create table if not exists kanban_cards (
  id          uuid primary key,
  column_id   uuid not null references kanban_columns(id) on delete restrict,
  title       text not null check (char_length(btrim(title)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 5000),
  tenant_id   uuid references tenants(id) on delete set null,
  priority    text check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date    date,
  version     integer not null default 1 check (version > 0),
  archived_at timestamptz,
  card_number integer,
  position    integer not null check (position >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (column_id, position) deferrable initially deferred
);
alter table kanban_cards add column if not exists tenant_id uuid
  references tenants(id) on delete set null;
alter table kanban_cards add column if not exists priority text
  check (priority in ('low', 'medium', 'high', 'urgent'));
alter table kanban_cards add column if not exists due_date date;
alter table kanban_cards add column if not exists version integer
  not null default 1 check (version > 0);
alter table kanban_cards add column if not exists archived_at timestamptz;
create sequence if not exists kanban_card_number_seq as integer;
alter table kanban_cards add column if not exists card_number integer
  check (card_number > 0);
alter sequence kanban_card_number_seq owned by kanban_cards.card_number;
alter table kanban_cards alter column card_number
  set default nextval('kanban_card_number_seq');
with numbered as materialized (
  select id, nextval('kanban_card_number_seq') as card_number
  from (
    select id from kanban_cards where card_number is null order by created_at, id
  ) existing
)
update kanban_cards card set card_number = numbered.card_number
from numbered
where card.id = numbered.id and card.card_number is null;
alter table kanban_cards alter column card_number set not null;
create unique index if not exists kanban_cards_number_idx
  on kanban_cards (card_number);
create index if not exists kanban_cards_tenant_idx
  on kanban_cards (tenant_id) where tenant_id is not null;
create index if not exists kanban_cards_archived_idx
  on kanban_cards (archived_at desc) where archived_at is not null;

insert into kanban_boards (key, title, schema_version)
values ('operations', 'Kanban', 2)
on conflict (key) do nothing;

with board as (
  select id from kanban_boards where key = 'operations'
), defaults(title, position) as (
  values ('A fazer', 0), ('Em andamento', 1), ('Em revisão', 2), ('Concluído', 3)
)
insert into kanban_columns (id, board_id, title, position)
select gen_random_uuid(), board.id, defaults.title, defaults.position
from board cross join defaults
where not exists (
  select 1 from kanban_columns kanban_column
  where kanban_column.board_id = board.id
    and kanban_column.title = defaults.title
)
on conflict do nothing;
