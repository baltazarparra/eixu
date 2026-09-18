import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { Client } from '@neondatabase/serverless';
import { del, list } from '@vercel/blob';
import {
  blobStoreId,
  privateBlobOptions,
  publicBlobOptions,
} from '../lib/blob/stores.mjs';
import {
  CLIENT_PROJECT_PREFIX,
  LEGACY_CLIENT_PROJECT_PREFIX,
  PRESERVED_TABLES,
  RESET_BLOB_TARGETS,
  SITE_TABLES,
  clientProjects,
  manifestScopeDigest,
  parseResetArgs,
  resourceDigest,
} from './reset-sites-lib.mjs';

const args = parseResetArgs(process.argv.slice(2));
const databaseUrl = process.env.EIXU_RESET_DATABASE_URL;
const vercelToken = process.env.EIXU_VERCEL_TOKEN;
const vercelTeamId = process.env.EIXU_VERCEL_TEAM_ID;
const rootProjectId = process.env.EIXU_VERCEL_ROOT_PROJECT_ID;
if (!databaseUrl)
  throw new Error('EIXU_RESET_DATABASE_URL é obrigatório e nunca é inferido.');
if (!vercelToken) throw new Error('EIXU_VERCEL_TOKEN é obrigatório.');
if (!vercelTeamId?.startsWith('team_'))
  throw new Error('EIXU_VERCEL_TEAM_ID é obrigatório.');
if (!rootProjectId?.startsWith('prj_'))
  throw new Error('EIXU_VERCEL_ROOT_PROJECT_ID é obrigatório.');
const blobTargets = await Promise.all(
  RESET_BLOB_TARGETS.map(async (target) => ({
    ...target,
    storeId: blobStoreId(target.access),
    options:
      target.access === 'private'
        ? await privateBlobOptions()
        : publicBlobOptions(),
  })),
);

const client = new Client(databaseUrl);
await client.connect();
let maintenanceEnabled = false;

function databaseFingerprint(value) {
  const parsed = new URL(value);
  return createHash('sha256')
    .update(`${parsed.hostname}${parsed.pathname}`)
    .digest('hex')
    .slice(0, 16);
}

async function tableNames(connection = client) {
  const result = await connection.query(
    `select tablename from pg_tables where schemaname = 'public'`,
  );
  return new Set(result.rows.map((row) => row.tablename));
}

async function counts(names, connection = client) {
  const existing = await tableNames(connection);
  const result = {};
  for (const name of names) {
    if (!existing.has(name)) continue;
    const count = await connection.query(
      `select count(*)::integer as count from "${name}"`,
    );
    result[name] = count.rows[0].count;
  }
  return result;
}

function identifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

/**
 * Não expõe dados do cliente: guarda somente hashes das chaves primárias.
 * Assim, trocar linhas entre aceite e execução invalida o manifesto mesmo se
 * as contagens permanecerem iguais.
 */
async function databaseInventories(existing) {
  const inventories = [];
  for (const table of SITE_TABLES) {
    if (!existing.has(table)) continue;
    const primary = await client.query(
      `select attribute.attname as name
       from pg_index idx
       join pg_class relation on relation.oid = idx.indrelid
       join pg_namespace namespace on namespace.oid = relation.relnamespace
       join unnest(idx.indkey) with ordinality as key(attnum, position) on true
       join pg_attribute attribute
         on attribute.attrelid = relation.oid and attribute.attnum = key.attnum
       where namespace.nspname = 'public'
         and relation.relname = $1
         and idx.indisprimary
       order by key.position`,
      [table],
    );
    const columns = primary.rows.map((row) => row.name);
    if (!columns.length)
      throw new Error(
        `A tabela ${table} não tem chave primária; o reset seguro foi recusado.`,
      );
    const fields = columns.map(identifier).join(', ');
    const rows = await client.query(
      `select ${fields} from ${identifier(table)} order by ${fields}`,
    );
    const digest = createHash('sha256');
    digest.update(`${table}\0${columns.join('\0')}\0`);
    for (const row of rows.rows)
      digest.update(
        `${JSON.stringify(columns.map((column) => String(row[column])))}\n`,
      );
    inventories.push({
      table,
      count: rows.rowCount ?? rows.rows.length,
      digest: digest.digest('hex'),
    });
  }
  return inventories;
}

async function databaseVercelProjects(existing) {
  const projects = [];
  if (existing.has('studio_projects')) {
    const result = await client.query(
      `select vercel_project_id as id,
              $1 || slug as expected_name,
              vercel_project_name as stored_name
       from studio_projects where vercel_project_id is not null`,
      [CLIENT_PROJECT_PREFIX],
    );
    projects.push(
      ...result.rows.map((row) => ({
        id: row.id,
        expectedName: row.expected_name,
        storedName: row.stored_name,
        source: 'studio_projects',
      })),
    );
  }
  if (existing.has('premium_projects')) {
    const result = await client.query(
      `select vercel_project_id as id,
              $1 || project_key as expected_name,
              vercel_project_name as stored_name
       from premium_projects where vercel_project_id is not null`,
      [LEGACY_CLIENT_PROJECT_PREFIX],
    );
    projects.push(
      ...result.rows.map((row) => ({
        id: row.id,
        expectedName: row.expected_name,
        storedName: row.stored_name,
        source: 'premium_projects',
      })),
    );
  }
  return projects;
}

async function vercelRequest(path, init = {}) {
  const url = new URL(path, 'https://api.vercel.com');
  url.searchParams.set('teamId', vercelTeamId);
  const response = await fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${vercelToken}`, ...init.headers },
    signal: AbortSignal.timeout(60_000),
  });
  if (response.status === 404) return { notFound: true };
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok)
    throw new Error(
      `Vercel ${response.status}: ${payload.error?.message ?? 'falha sem mensagem'}`,
    );
  return payload;
}

async function listVercelProjects() {
  const projects = [];
  let until;
  do {
    const suffix = until ? `&until=${encodeURIComponent(until)}` : '';
    const page = await vercelRequest(`/v10/projects?limit=100${suffix}`);
    projects.push(
      ...(page.projects ?? []).map((project) => ({
        id: project.id,
        name: project.name,
      })),
    );
    until = page.pagination?.next ?? null;
  } while (until);
  return projects;
}

async function blobInventory({ access, prefix, storeId, options }) {
  let cursor;
  const paths = [];
  let bytes = 0;
  do {
    const page = await list({ ...options, prefix, cursor, limit: 1000 });
    for (const blob of page.blobs) {
      paths.push(blob.pathname);
      bytes += blob.size;
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return {
    access,
    storeId,
    prefix,
    count: paths.length,
    bytes,
    digest: resourceDigest(paths, createHash),
  };
}

async function verifyPlatformDeployment() {
  const deploymentId = process.env.EIXU_RESET_PLATFORM_DEPLOYMENT_ID;
  if (!deploymentId)
    throw new Error(
      'EIXU_RESET_PLATFORM_DEPLOYMENT_ID é obrigatório na execução.',
    );
  const deployment = await vercelRequest(
    `/v13/deployments/${encodeURIComponent(deploymentId)}`,
  );
  const projectId = deployment.projectId ?? deployment.project?.id;
  if (projectId !== rootProjectId)
    throw new Error(
      'O deployment informado não pertence ao projeto raiz protegido.',
    );
  if ((deployment.readyState ?? deployment.status) !== 'READY')
    throw new Error('O deployment da plataforma ainda não está READY.');
  return deploymentId;
}

async function setMaintenance(active) {
  await client.query(
    `insert into platform_settings (key, value, updated_at)
     values ('sites_maintenance', $1::jsonb, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [JSON.stringify(active)],
  );
}

async function buildManifest() {
  const existing = await tableNames();
  const [
    siteCounts,
    preservedCounts,
    databaseInventory,
    vercelProjects,
    blobs,
  ] = await Promise.all([
    counts(SITE_TABLES),
    counts(PRESERVED_TABLES),
    databaseInventories(existing),
    listVercelProjects(),
    Promise.all(blobTargets.map(blobInventory)),
  ]);
  const databaseProjects = await databaseVercelProjects(existing);
  const projects = clientProjects({
    databaseProjects,
    vercelProjects,
    rootProjectId,
  });
  const manifest = {
    schemaVersion: 2,
    mode: args.execute ? 'execute' : 'manifest',
    environment: args.environment,
    createdAt:
      args.execute && args.manifestCreatedAt
        ? args.manifestCreatedAt
        : new Date().toISOString(),
    database: {
      fingerprint: databaseFingerprint(databaseUrl),
      resetCounts: siteCounts,
      preservedCounts,
      inventories: databaseInventory,
    },
    vercel: {
      teamId: vercelTeamId,
      protectedProjectId: rootProjectId,
      clientProjectPrefixes: [
        CLIENT_PROJECT_PREFIX,
        LEGACY_CLIENT_PROJECT_PREFIX,
      ],
      deleteProjects: projects,
    },
    blob: { inventories: blobs },
  };
  return {
    ...manifest,
    scopeDigest: manifestScopeDigest(manifest, createHash),
  };
}

async function writeReceipt(kind, value) {
  await mkdir(new URL('../outputs/', import.meta.url), { recursive: true });
  const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
  const path = new URL(
    `../outputs/reset-sites-${args.environment}-${kind}-${stamp}.json`,
    import.meta.url,
  );
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  return path.pathname;
}

async function removeVercelProjects(projects) {
  for (const target of projects) {
    if (target.id === rootProjectId)
      throw new Error(
        'Proteção acionada: tentativa de remover o projeto raiz.',
      );
    const current = await vercelRequest(
      `/v9/projects/${encodeURIComponent(target.id)}`,
    );
    if (current.notFound) continue;
    if (current.id !== target.id || current.name !== target.name)
      throw new Error(
        `A identidade do projeto Vercel mudou desde o manifesto: ${target.id}`,
      );
    await vercelRequest(`/v9/projects/${encodeURIComponent(target.id)}`, {
      method: 'DELETE',
    });
  }
}

async function removeBlobPrefix({ prefix, options }) {
  let deleted = 0;
  for (;;) {
    const page = await list({ ...options, prefix, limit: 1000 });
    const urls = page.blobs.map((blob) => blob.url);
    if (!urls.length) break;
    for (let index = 0; index < urls.length; index += 100) {
      const batch = urls.slice(index, index + 100);
      if (batch.length) await del(batch, options);
      deleted += batch.length;
    }
  }
  return deleted;
}

async function resetDatabase(manifest, deploymentId, recoveryRef) {
  await client.query('begin');
  try {
    await client.query(`set local statement_timeout = '5min'`);
    await client.query(
      `update kanban_cards set tenant_id = null where tenant_id is not null`,
    );
    await client.query(
      `update admin_activity set tenant_id = null
       where tenant_id is not null and action like 'kanban.%'`,
    );
    await client.query(
      `delete from admin_activity
       where action not like 'auth.%' and action not like 'kanban.%'`,
    );

    await client.query(
      `alter table if exists premium_projects
       drop column if exists active_release_id,
       drop column if exists active_content_revision_id`,
    );
    await client.query(
      `alter table if exists ai_usage drop column if exists run_id`,
    );
    await client.query(
      `alter table if exists leads drop column if exists page_id`,
    );

    const existing = await tableNames(client);
    const deleteOrder = [
      'studio_tool_leases',
      'studio_events',
      'chat_messages',
      'ai_usage',
      'studio_preview_sessions',
      'studio_source_evidence',
      'studio_artifacts',
      'studio_runs',
    ];
    for (const table of deleteOrder)
      if (existing.has(table)) await client.query(`delete from "${table}"`);
    if (existing.has('studio_projects'))
      await client.query(
        `update studio_projects
         set active_release_id = null, active_content_revision_id = null`,
      );
    for (const table of [
      'studio_releases',
      'studio_content_revisions',
      'studio_projects',
      'images',
      'leads',
      'events',
      'campaign_spend',
    ])
      if (existing.has(table)) await client.query(`delete from "${table}"`);

    for (const table of [
      'premium_preview_sessions',
      'premium_content_revisions',
      'premium_releases',
      'premium_conversions',
      'premium_projects',
      'generation_events',
      'generation_runs',
      'page_revisions',
      'pages',
    ])
      await client.query(`drop table if exists "${table}"`);

    await client.query(`delete from tenants`);
    await client.query(`delete from site_folders`);
    await client.query(
      `alter table tenants
       drop column if exists dials,
       drop column if exists image_guide,
       drop column if exists published_snapshot,
       drop column if exists maintenance_mode,
       drop column if exists public_runtime`,
    );

    for (const statement of [
      `alter table tenants drop constraint if exists tenants_slug_check`,
      `alter table tenants add constraint tenants_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')`,
      `alter table tenants drop constraint if exists tenants_status_check`,
      `alter table tenants add constraint tenants_status_check check (status in ('draft', 'published', 'archived'))`,
      `alter table images drop constraint if exists images_kind_check`,
      `alter table images add constraint images_kind_check check (kind in ('foto', 'logo'))`,
      `alter table images drop constraint if exists images_status_check`,
      `alter table images add constraint images_status_check check (status in ('disponivel', 'candidata', 'aprovada', 'rejeitada'))`,
      `alter table ai_usage drop constraint if exists ai_usage_lifecycle_check`,
      `alter table ai_usage add constraint ai_usage_lifecycle_check check (lifecycle = 'studio')`,
    ])
      await client.query(statement);

    await client.query(
      `insert into platform_settings (key, value, updated_at)
       values ('sites_reset_last_receipt', $1::jsonb, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [
        JSON.stringify({
          environment: args.environment,
          scopeDigest: manifest.scopeDigest,
          recoveryRef,
          platformDeploymentId: deploymentId,
          resetAt: new Date().toISOString(),
        }),
      ],
    );
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  }
}

async function verifyReset(projects) {
  const resetCounts = await counts(SITE_TABLES);
  const nonZero = Object.entries(resetCounts).filter(
    ([, count]) => count !== 0,
  );
  if (nonZero.length)
    throw new Error(
      `O banco ainda contém dados de sites: ${JSON.stringify(nonZero)}`,
    );
  const cardRefs = await client.query(
    `select count(*)::integer as count from kanban_cards where tenant_id is not null`,
  );
  if (cardRefs.rows[0].count !== 0)
    throw new Error('O Kanban ainda contém referências a tenants removidos.');
  for (const target of projects) {
    const project = await vercelRequest(
      `/v9/projects/${encodeURIComponent(target.id)}`,
    );
    if (!project.notFound)
      throw new Error(`O projeto Vercel ${target.id} ainda existe.`);
  }
  const blob = await Promise.all(blobTargets.map(blobInventory));
  if (blob.some((item) => item.count !== 0))
    throw new Error('Ainda existem objetos Blob nos prefixos de sites.');
  return {
    resetCounts,
    preservedCounts: await counts(PRESERVED_TABLES),
    vercelProjectsRemaining: 0,
    blob,
  };
}

try {
  const manifest = await buildManifest();
  const manifestPath = await writeReceipt('manifest', manifest);
  if (!args.execute) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: 'manifest',
          environment: args.environment,
          createdAt: manifest.createdAt,
          scopeDigest: manifest.scopeDigest,
          databaseFingerprint: manifest.database.fingerprint,
          manifestPath,
          databaseCounts: manifest.database.resetCounts,
          preservedCounts: manifest.database.preservedCounts,
          vercelProjects: manifest.vercel.deleteProjects,
          blob: manifest.blob.inventories,
        },
        null,
        2,
      ),
    );
  } else {
    if (args.scopeDigest !== manifest.scopeDigest)
      throw new Error(
        'O escopo mudou desde o manifesto. Gere e revise um novo manifesto.',
      );
    if (args.databaseFingerprint !== manifest.database.fingerprint)
      throw new Error(
        'O banco informado não corresponde ao manifesto aprovado.',
      );
    const recoveryRef = process.env.EIXU_RESET_RECOVERY_REF;
    if (!recoveryRef)
      throw new Error('EIXU_RESET_RECOVERY_REF é obrigatório na execução.');
    const deploymentId = await verifyPlatformDeployment();
    await setMaintenance(true);
    maintenanceEnabled = true;
    await removeVercelProjects(manifest.vercel.deleteProjects);
    const deletedBlobs = {};
    for (const target of blobTargets)
      deletedBlobs[`${target.storeId}/${target.prefix}`] =
        await removeBlobPrefix(target);
    await resetDatabase(manifest, deploymentId, recoveryRef);
    const verification = await verifyReset(manifest.vercel.deleteProjects);
    await setMaintenance(false);
    maintenanceEnabled = false;
    const receipt = {
      ...manifest,
      mode: 'executed',
      completedAt: new Date().toISOString(),
      platformDeploymentId: deploymentId,
      recoveryRef,
      deletedBlobs,
      verification,
    };
    const receiptPath = await writeReceipt('receipt', receipt);
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: 'executed',
          environment: args.environment,
          scopeDigest: manifest.scopeDigest,
          receiptPath,
          verification,
        },
        null,
        2,
      ),
    );
  }
} catch (error) {
  const failure = {
    ok: false,
    environment: args.environment,
    failedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : 'Falha desconhecida',
    maintenanceRemainsEnabled: maintenanceEnabled,
  };
  const failurePath = await writeReceipt('failed', failure).catch(() => null);
  console.error(JSON.stringify({ ...failure, failurePath }, null, 2));
  process.exitCode = 1;
} finally {
  await client.end();
}
