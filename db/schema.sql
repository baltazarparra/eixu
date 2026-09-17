-- EIXU Sites: schema do gerador multi-tenant.
-- Idempotente: pode rodar novamente sem quebrar.

create extension if not exists pgcrypto;

create table if not exists tenants (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  -- draft, published ou archived; arquivar preserva os snapshots publicados.
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

-- Organização compartilhada da biblioteca administrativa. Pastas não alteram
-- publicação, domínio ou conteúdo; ao excluir uma pasta, os sites permanecem.
create table if not exists site_folders (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tenants add column if not exists folder_id uuid references site_folders(id) on delete set null;

-- Operadores internos. O PIN nunca é persistido; somente o hash com salt.
create table if not exists admin_users (
  id         uuid primary key default gen_random_uuid(),
  login      text not null unique check (login = lower(btrim(login))),
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  pin_hash   text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- O navegador recebe um token aleatório; somente seu SHA-256 fica no banco.
create table if not exists admin_sessions (
  token_hash text primary key,
  user_id    uuid not null references admin_users(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- Limite compartilhado entre instâncias para proteger o PIN curto.
create table if not exists admin_login_attempts (
  login              text primary key,
  failures           integer not null default 0,
  window_started_at  timestamptz not null default now(),
  blocked_until      timestamptz,
  updated_at         timestamptz not null default now()
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
-- metadado, a crítica e a disponibilidade. Não há aprovação de imagens.
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
  status         text not null default 'disponivel',
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
alter table chat_messages add column if not exists admin_user_id uuid references admin_users(id) on delete set null;
alter table chat_messages add column if not exists actor_type text not null default 'legacy';
alter table chat_messages add column if not exists actor_name text;
alter table chat_messages add column if not exists actor_login text;
-- 'foto' ou 'logo'. Coluna própria porque target_block é enum de blocos do site.
alter table images        add column if not exists kind text not null default 'foto';
-- Telefones, endereços e redes do cliente. Coluna própria porque brand é
-- reescrita inteira pelas ferramentas do agente e brief é briefing; estes são
-- dados de produto renderizados no rodapé e na seção de localização.
alter table tenants       add column if not exists contacts jsonb not null default '{}'::jsonb;
-- Snapshot da apresentação global. Mantém marca, vibe e contatos do site no
-- ar enquanto o rascunho recebe uma recomposição completa.
alter table tenants       add column if not exists published_snapshot jsonb;
alter table pages         add column if not exists published_title text;
alter table pages         add column if not exists published_type text;
alter table pages         add column if not exists published_meta jsonb;
alter table pages         add column if not exists published_nav_order int;
-- O estado editorial continua em `status`. Estes dois eixos dizem quem pode
-- manter a implementacao e qual runtime atende a URL publica. Durante a
-- conversao o gerador fica bloqueado, mas o snapshot publicado segue no ar.
alter table tenants       add column if not exists maintenance_mode text not null default 'generator'
  check (maintenance_mode in ('generator', 'converting', 'premium'));
alter table tenants       add column if not exists public_runtime text not null default 'generator'
  check (public_runtime in ('generator', 'premium'));

-- A primeira aplicação captura o que já está no ar. Sem este backfill, uma
-- edição de marca ou metadado posterior à migração ainda vazaria para clientes
-- publicados antes do snapshot. Telefones e rede social legados seguem a mesma
-- recuperação tolerante de lib/tenant-contacts.ts.
update tenants
set published_snapshot = jsonb_build_object(
  'name', name,
  'brand', brand,
  'dials', dials,
  'contacts', coalesce(contacts, '{}'::jsonb) || jsonb_build_object(
    'phones', case
      when jsonb_typeof(contacts -> 'phones') = 'array'
           and jsonb_array_length(contacts -> 'phones') > 0
        then contacts -> 'phones'
      when nullif(whatsapp, '') is not null
        then jsonb_build_array(jsonb_build_object('number', whatsapp, 'whatsapp', true))
      else '[]'::jsonb
    end,
    'addresses', case
      when jsonb_typeof(contacts -> 'addresses') = 'array'
        then contacts -> 'addresses'
      else '[]'::jsonb
    end,
    'social', case
      when jsonb_typeof(contacts -> 'social') = 'array'
        then contacts -> 'social'
      when nullif(brief #>> '{intake,socialUrl}', '') is not null
        then jsonb_build_array(brief #>> '{intake,socialUrl}')
      else '[]'::jsonb
    end
  ),
  'whatsapp', whatsapp,
  'contactEmail', contact_email,
  'locale', locale
)
where status = 'published' and published_snapshot is null;

update pages
set published_title = title,
    published_type = type,
    published_meta = meta,
    published_nav_order = nav_order
where published_blocks is not null
  and (published_title is null
    or published_type is null
    or published_meta is null
    or published_nav_order is null);

create index if not exists pages_tenant_idx        on pages (tenant_id);
create unique index if not exists site_folders_name_unique_idx on site_folders (lower(btrim(name)));
create index if not exists tenants_folder_idx       on tenants (folder_id);
create index if not exists images_tenant_time_idx  on images (tenant_id, created_at desc);
create index if not exists images_batch_idx        on images (batch_id);
create index if not exists leads_tenant_time_idx   on leads (tenant_id, created_at desc);
create index if not exists events_tenant_time_idx  on events (tenant_id, created_at desc);
create index if not exists events_tenant_type_idx  on events (tenant_id, type);
create index if not exists chat_tenant_time_idx    on chat_messages (tenant_id, created_at);
create index if not exists spend_tenant_idx        on campaign_spend (tenant_id);
create index if not exists admin_sessions_user_idx on admin_sessions (user_id, expires_at desc);
create index if not exists admin_sessions_expiry_idx on admin_sessions (expires_at);

-- Projeto de codigo que substitui o runtime do gerador sem mudar a URL do
-- cliente. O token da ponte e guardado apenas como hash; o segredo cru e
-- entregue uma vez ao executor e instalado somente no projeto correspondente.
create table if not exists premium_projects (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null unique references tenants(id) on delete restrict,
  project_key           text not null unique
    check (project_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  directory             text not null unique,
  canonical_host        text not null unique,
  vercel_project_id     text,
  vercel_project_name   text,
  bridge_token_hash     text,
  status                text not null default 'preparing'
    check (status in ('preparing', 'active', 'failed', 'archived')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- A captura publicada fica congelada no pedido. Assim a exportacao e
-- reproduzivel e uma alteracao posterior do rascunho nao muda o artefato.
create table if not exists premium_conversions (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id) on delete restrict,
  project_id            uuid not null references premium_projects(id) on delete restrict,
  requested_by          uuid references admin_users(id) on delete set null,
  status                text not null default 'queued'
    check (status in ('queued', 'claimed', 'exported', 'deploying', 'activated', 'failed', 'canceled')),
  source_snapshot       jsonb not null,
  source_hash           text not null,
  source_commit         text not null,
  converter_version     text not null,
  branch                text,
  pull_request_url      text,
  claimed_at            timestamptz,
  lease_expires_at      timestamptz,
  finished_at           timestamptz,
  error                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index if not exists premium_conversions_active_tenant_idx
  on premium_conversions (tenant_id)
  where status in ('queued', 'claimed', 'exported', 'deploying');
create index if not exists premium_conversions_queue_idx
  on premium_conversions (status, created_at);

-- Cada deploy e imutavel. O dominio canonico permanece ligado ao projeto; um
-- novo deploy de producao troca automaticamente o que a mesma URL entrega.
create table if not exists premium_releases (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references premium_projects(id) on delete restrict,
  conversion_id         uuid references premium_conversions(id) on delete restrict,
  commit_sha            text not null,
  deployment_id         text not null unique,
  deployment_url        text not null,
  status                text not null default 'ready'
    check (status in ('ready', 'active', 'failed', 'rolled_back')),
  manifest              jsonb not null default '{}'::jsonb,
  activated_at          timestamptz,
  created_at            timestamptz not null default now()
);

alter table premium_projects add column if not exists active_release_id uuid
  references premium_releases(id) on delete set null;
create index if not exists premium_releases_project_time_idx
  on premium_releases (project_id, created_at desc);

-- O código Premium define a composição e o contrato dos campos; o conteúdo
-- publicado pelo painel vive em revisões imutáveis. O ponteiro troca apenas
-- depois da validação completa, preservando concorrência e histórico.
create table if not exists premium_content_revisions (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references premium_projects(id) on delete restrict,
  revision              integer not null check (revision > 0),
  schema_version        integer not null check (schema_version > 0),
  contract_hash         text not null check (contract_hash ~ '^[0-9a-f]{64}$'),
  content               jsonb not null check (jsonb_typeof(content) = 'object'),
  created_by            uuid references admin_users(id) on delete set null,
  created_at            timestamptz not null default now(),
  unique (project_id, revision)
);
alter table premium_content_revisions
  add column if not exists contract_hash text not null default repeat('0', 64)
  check (contract_hash ~ '^[0-9a-f]{64}$');
alter table premium_content_revisions alter column contract_hash drop default;
alter table premium_projects add column if not exists active_content_revision_id uuid
  references premium_content_revisions(id) on delete set null;
create index if not exists premium_content_revisions_project_time_idx
  on premium_content_revisions (project_id, created_at desc);

-- A prévia usa o frontend canônico com um rascunho efêmero. O token cru só
-- aparece no navegador autenticado; o banco guarda SHA-256 e expiração curta.
create table if not exists premium_preview_sessions (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references premium_projects(id) on delete cascade,
  token_hash            text not null unique,
  schema_version        integer not null check (schema_version > 0),
  contract_hash         text not null check (contract_hash ~ '^[0-9a-f]{64}$'),
  content               jsonb not null check (jsonb_typeof(content) = 'object'),
  client_version        integer not null default 0 check (client_version >= 0),
  created_by            uuid references admin_users(id) on delete set null,
  expires_at            timestamptz not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
alter table premium_preview_sessions
  add column if not exists contract_hash text not null default repeat('0', 64)
  check (contract_hash ~ '^[0-9a-f]{64}$');
alter table premium_preview_sessions alter column contract_hash drop default;
create index if not exists premium_preview_sessions_project_expiry_idx
  on premium_preview_sessions (project_id, expires_at desc);

-- Execução da geração em etapas. O laço vivia no navegador: fechar a aba ou
-- recarregar matava a sequência sem deixar rastro, e o painel voltava
-- oferecendo "Continuar" enquanto um turno ainda rodava no servidor.
create table if not exists generation_runs (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  -- queued | running | stopping | paused | done | failed
  status           text not null default 'queued',
  phase            text,
  phase_started_at timestamptz,
  started_at       timestamptz not null default now(),
  heartbeat_at     timestamptz not null default now(),
  finished_at      timestamptz,
  error            text,
  -- Fases-passo já encadeadas. A etapa de cenas repete a mesma fase.
  hops             int not null default 0,
  -- Marcador de avanço ('cenas:3'): igual ao anterior significa etapa parada.
  progress         text,
  -- Origem que iniciou o run: a revisão renderiza a prévia por ela.
  origin           text not null,
  created_at       timestamptz not null default now()
);

-- O que o painel mostra como andamento. Sem conteúdo do cliente: rótulo curto
-- e contadores. Sobrevive a recarga, troca de aba e fim da sessão.
create table if not exists generation_events (
  id         bigserial primary key,
  run_id     uuid not null references generation_runs(id) on delete cascade,
  tenant_id  uuid not null references tenants(id) on delete cascade,
  phase      text not null,
  -- phase_start | tool_start | tool_end | note | phase_end | stopped | error
  kind       text not null,
  tool       text,
  label      text not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table generation_runs add column if not exists requested_by uuid references admin_users(id) on delete set null;
alter table generation_runs add column if not exists requester_name text;
alter table generation_runs add column if not exists requester_login text;
alter table generation_runs add column if not exists stop_requested_by uuid references admin_users(id) on delete set null;
alter table generation_runs add column if not exists stop_requester_name text;
alter table generation_runs add column if not exists stop_requester_login text;

-- Um run ativo por cliente. O índice parcial é a garantia real contra duas
-- gerações simultâneas; a checagem na rota é só a mensagem amigável.
create unique index if not exists generation_runs_active_idx
  on generation_runs (tenant_id) where status in ('queued', 'running', 'stopping');
create index if not exists generation_runs_tenant_time_idx on generation_runs (tenant_id, created_at desc);
create index if not exists generation_events_run_idx on generation_events (run_id, id);

-- Consumo por chamada: guarda apenas contadores e identificadores, nunca
-- prompts, conteúdo do cliente ou credenciais. O recibo nasce antes da chamada;
-- uma interrupção pode deixá-lo pendente, em vez de fingir custo zero.
create table if not exists ai_usage (
  id                 bigserial primary key,
  tenant_id          uuid not null references tenants(id) on delete cascade,
  operation_id       text not null,
  step               int not null check (step >= 0),
  kind               text not null,
  model              text not null,
  phase              text,
  run_id             uuid references generation_runs(id) on delete set null,
  status             text not null default 'pending'
    check (status in ('pending', 'recorded', 'failed')),
  input_tokens       bigint check (input_tokens >= 0),
  output_tokens      bigint check (output_tokens >= 0),
  total_tokens       bigint check (total_tokens >= 0),
  cache_read_tokens  bigint check (cache_read_tokens >= 0),
  cache_write_tokens bigint check (cache_write_tokens >= 0),
  reasoning_tokens   bigint check (reasoning_tokens >= 0),
  cost_usd           numeric(20, 10) check (cost_usd >= 0),
  legacy             boolean not null default false,
  created_at         timestamptz not null default now(),
  finished_at        timestamptz,
  unique (tenant_id, operation_id, step)
);

-- Classificação no instante da chamada, nunca pelo estado atual do cliente.
-- Recibos anteriores permanecem sem fase; não se inventa uma data de conversão.
alter table ai_usage add column if not exists source text not null default 'gateway';
alter table ai_usage add column if not exists lifecycle text not null default 'unknown'
  check (lifecycle in ('unknown', 'generator', 'converting', 'premium'));
alter table ai_usage add column if not exists external_id text;
-- Um recibo externo não pode ser atribuído a dois clientes.
create unique index if not exists ai_usage_external_receipt_idx
  on ai_usage (source, external_id) where external_id is not null;

create index if not exists ai_usage_tenant_time_idx
  on ai_usage (tenant_id, created_at desc, id desc);

-- Recupera somente recibos antigos que já existem. Chamadas novas são medidas
-- por passo e marcam usageLedger no resumo da fase para impedir dupla contagem.
insert into ai_usage (
  tenant_id, operation_id, step, kind, model, phase, run_id, status,
  input_tokens, output_tokens, total_tokens, cache_read_tokens,
  cache_write_tokens, reasoning_tokens, cost_usd, legacy,
  created_at, finished_at
)
select
  tenant_id, 'legacy-generation-' || id, 0, 'geracao',
  coalesce(payload #>> '{usage,model}', 'Não informado'), phase, run_id,
  'recorded',
  case when jsonb_typeof(payload #> '{usage,inputTokens}') = 'number'
    and (payload #>> '{usage,inputTokens}')::numeric >= 0
    then (payload #>> '{usage,inputTokens}')::bigint end,
  case when jsonb_typeof(payload #> '{usage,outputTokens}') = 'number'
    and (payload #>> '{usage,outputTokens}')::numeric >= 0
    then (payload #>> '{usage,outputTokens}')::bigint end,
  case when jsonb_typeof(payload #> '{usage,totalTokens}') = 'number'
    and (payload #>> '{usage,totalTokens}')::numeric >= 0
    then (payload #>> '{usage,totalTokens}')::bigint end,
  case when jsonb_typeof(payload #> '{usage,cacheReadTokens}') = 'number'
    and (payload #>> '{usage,cacheReadTokens}')::numeric >= 0
    then (payload #>> '{usage,cacheReadTokens}')::bigint end,
  case when jsonb_typeof(payload #> '{usage,cacheWriteTokens}') = 'number'
    and (payload #>> '{usage,cacheWriteTokens}')::numeric >= 0
    then (payload #>> '{usage,cacheWriteTokens}')::bigint end,
  case when jsonb_typeof(payload #> '{usage,reasoningTokens}') = 'number'
    and (payload #>> '{usage,reasoningTokens}')::numeric >= 0
    then (payload #>> '{usage,reasoningTokens}')::bigint end,
  case when jsonb_typeof(payload #> '{usage,costUsd}') = 'number'
    and (payload #>> '{usage,costUsd}')::numeric >= 0
    then (payload #>> '{usage,costUsd}')::numeric end,
  true, created_at, created_at
from generation_events
where kind = 'phase_end'
  and jsonb_typeof(payload -> 'usage') = 'object'
  and coalesce(payload ->> 'usageLedger', 'false') <> 'true'
on conflict (tenant_id, operation_id, step) do nothing;

-- Linha do tempo administrativa. O snapshot de nome/login e o SET NULL
-- preservam a autoria mesmo depois de desativar uma conta ou excluir um cliente.
create table if not exists admin_activity (
  id             bigserial primary key,
  user_id        uuid references admin_users(id) on delete set null,
  actor_type     text not null default 'user',
  actor_name     text,
  actor_login    text,
  tenant_id      uuid references tenants(id) on delete set null,
  tenant_slug    text,
  tenant_name    text,
  action         text not null,
  resource_type  text,
  resource_id    text,
  result         text not null default 'success',
  summary        text not null,
  operation_id   text unique,
  detail         jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists admin_activity_time_idx on admin_activity (created_at desc, id desc);
create index if not exists admin_activity_tenant_idx on admin_activity (tenant_id, created_at desc, id desc);
create index if not exists admin_activity_user_idx on admin_activity (user_id, created_at desc, id desc);

-- Histórico curto do rascunho de cada página. Uma edição pontual sobrescrevia
-- `pages.blocks` sem deixar cópia: quando o agente removia a seção errada, não
-- havia como voltar e a "reversão" virava um bloco novo inventado. Guarda o
-- estado anterior a cada escrita do rascunho; snapshots publicados não entram.
create table if not exists page_revisions (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  page_id    uuid not null references pages(id) on delete cascade,
  blocks     jsonb not null,
  revision   text not null,
  -- chat | previa | geracao | desfazer
  origin     text not null default 'chat',
  summary    text,
  created_at timestamptz not null default now()
);

create index if not exists page_revisions_page_time_idx
  on page_revisions (page_id, created_at desc);

-- Quadro interno da operação. É global; cada cartão pode referenciar um tenant.
create table if not exists kanban_boards (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique,
  title      text not null,
  revision   bigint not null default 0 check (revision >= 0),
  schema_version integer not null default 2 check (schema_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabelas do primeiro piloto não tinham versão de schema. O valor 1 permite
-- acrescentar a quarta etapa uma única vez sem recriá-la após uma exclusão.
alter table kanban_boards
  add column if not exists schema_version integer not null default 1
  check (schema_version > 0);

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
  position    integer not null check (position >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (column_id, position) deferrable initially deferred
);

-- Evolução aditiva para instalações que já receberam o primeiro piloto.
alter table kanban_cards
  add column if not exists tenant_id uuid references tenants(id) on delete set null;
alter table kanban_cards
  add column if not exists priority text
  check (priority in ('low', 'medium', 'high', 'urgent'));
alter table kanban_cards add column if not exists due_date date;
alter table kanban_cards
  add column if not exists version integer not null default 1 check (version > 0);
alter table kanban_cards add column if not exists archived_at timestamptz;

-- Referência humana global e permanente. A sequência nunca é reiniciada na
-- reaplicação, nem ao excluir cartões; lacunas são permitidas.
create sequence if not exists kanban_card_number_seq as integer;
alter table kanban_cards
  add column if not exists card_number integer check (card_number > 0);
alter sequence kanban_card_number_seq owned by kanban_cards.card_number;
alter table kanban_cards
  alter column card_number set default nextval('kanban_card_number_seq');
with numbered as materialized (
  select id, nextval('kanban_card_number_seq') as card_number
  from (
    select id from kanban_cards where card_number is null order by created_at, id
  ) existing
)
update kanban_cards k set card_number = numbered.card_number
from numbered where k.id = numbered.id and k.card_number is null;
alter table kanban_cards alter column card_number set not null;
create unique index if not exists kanban_cards_number_idx
  on kanban_cards (card_number);

create index if not exists kanban_cards_tenant_idx
  on kanban_cards (tenant_id) where tenant_id is not null;
create index if not exists kanban_cards_archived_idx
  on kanban_cards (archived_at desc) where archived_at is not null;

-- Um statement para a primeira criação: migrate.mjs executa statements isolados.
-- Reaplicar o schema não restaura colunas que já foram alteradas ou excluídas.
with inserted_board as (
  insert into kanban_boards (key, title) values ('operations', 'Kanban')
  on conflict (key) do nothing returning id
), defaults(title, position) as (
  values
    ('A fazer', 0),
    ('Em andamento', 1),
    ('Em revisão', 2),
    ('Concluído', 3)
)
insert into kanban_columns (id, board_id, title, position)
select gen_random_uuid(), inserted_board.id, defaults.title, defaults.position
from inserted_board cross join defaults;

-- Acrescenta "Em revisão" uma vez aos quadros criados pelo piloto v1. O CTE
-- desloca as posições na mesma instrução para preservar a restrição deferida.
with upgraded_board as (
  update kanban_boards
  set schema_version = 2, updated_at = now()
  where key = 'operations' and schema_version < 2
  returning id
), target as (
  select upgraded_board.id,
    least(2, count(kanban_columns.id))::integer as insert_position,
    coalesce(bool_or(kanban_columns.title = 'Em revisão'), false) as has_review
  from upgraded_board
  left join kanban_columns on kanban_columns.board_id = upgraded_board.id
  group by upgraded_board.id
), shifted as (
  update kanban_columns
  set position = kanban_columns.position + 1, updated_at = now()
  from target
  where kanban_columns.board_id = target.id
    and not target.has_review
    and kanban_columns.position >= target.insert_position
  returning kanban_columns.id
)
insert into kanban_columns (id, board_id, title, position)
select gen_random_uuid(), target.id, 'Em revisão', target.insert_position
from target
where not target.has_review;

alter table kanban_boards alter column schema_version set default 2;
