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
create index if not exists images_tenant_time_idx  on images (tenant_id, created_at desc);
create index if not exists images_batch_idx        on images (batch_id);
create index if not exists leads_tenant_time_idx   on leads (tenant_id, created_at desc);
create index if not exists events_tenant_time_idx  on events (tenant_id, created_at desc);
create index if not exists events_tenant_type_idx  on events (tenant_id, type);
create index if not exists chat_tenant_time_idx    on chat_messages (tenant_id, created_at);
create index if not exists spend_tenant_idx        on campaign_spend (tenant_id);

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

-- Um run ativo por cliente. O índice parcial é a garantia real contra duas
-- gerações simultâneas; a checagem na rota é só a mensagem amigável.
create unique index if not exists generation_runs_active_idx
  on generation_runs (tenant_id) where status in ('queued', 'running', 'stopping');
create index if not exists generation_runs_tenant_time_idx on generation_runs (tenant_id, created_at desc);
create index if not exists generation_events_run_idx on generation_events (run_id, id);
