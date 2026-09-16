import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJiti } from 'jiti';
import { loadModule } from './helpers/load-module.mjs';

const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
const snapshotModule = await j.import('../lib/premium/snapshot.ts');
const access = await j.import('../lib/premium/access.ts');
const execFileAsync = promisify(execFile);

function fixture() {
  const publishedSnapshot = {
    name: 'Projeto Premium',
    brand: { accent: '#123456', logoUrl: 'https://assets.test/logo.svg' },
    dials: { variance: 4, motion: 3, density: 5 },
    contacts: { phones: [], addresses: [], social: [] },
    whatsapp: null,
    contactEmail: 'publico@example.com',
    locale: 'pt-BR',
  };
  const tenant = {
    id: '00000000-0000-4000-8000-000000000001',
    slug: 'projeto-premium',
    name: 'Rascunho que nao pode vazar',
    status: 'published',
    maintenanceMode: 'generator',
    publicRuntime: 'generator',
    brief: { segredo: 'nao exportar' },
    brand: { accent: '#ffffff' },
    dials: { variance: 9, motion: 9, density: 9 },
    imageGuide: { notas: 'privado' },
    contacts: { phones: [], addresses: [], social: [] },
    whatsapp: null,
    contactEmail: null,
    ga4Id: 'G-PUBLICO',
    metaPixelId: null,
    locale: 'pt-BR',
    publishedSnapshot,
  };
  const page = {
    id: '00000000-0000-4000-8000-000000000002',
    tenantId: tenant.id,
    slug: '',
    type: 'page',
    title: 'Titulo em rascunho',
    seo: { title: 'SEO em rascunho' },
    meta: {},
    blocks: [
      { id: 'draft', type: 'editorial.text', props: { body: 'rascunho' } },
    ],
    navOrder: 3,
    publishedBlocks: [
      {
        id: 'live',
        type: 'editorial.text',
        props: { body: 'publicado', image: 'https://assets.test/foto.webp' },
      },
    ],
    publishedSeo: { title: 'SEO publicado' },
    publishedTitle: 'Titulo publicado',
    publishedType: 'page',
    publishedMeta: {},
    publishedNavOrder: 1,
    publishedAt: '2026-09-16T00:00:00.000Z',
  };
  return { tenant, page };
}

await test('conversao congela somente o snapshot publicado e tem hash JSON estavel', () => {
  const { tenant, page } = fixture();
  const snapshot = snapshotModule.premiumSourceSnapshot(tenant, [page]);
  assert.equal(snapshot.tenant.name, 'Projeto Premium');
  assert.equal(snapshot.pages[0].title, 'Titulo publicado');
  assert.equal(snapshot.pages[0].blocks[0].id, 'live');
  assert.equal(JSON.stringify(snapshot).includes('rascunho'), false);
  assert.equal(JSON.stringify(snapshot).includes('segredo'), false);
  assert.deepEqual(snapshot.assets, [
    'https://assets.test/foto.webp',
    'https://assets.test/logo.svg',
  ]);
  assert.equal(
    snapshotModule.premiumSourceHash(snapshot),
    snapshotModule.premiumSourceHash(JSON.parse(JSON.stringify(snapshot))),
  );
});

await test('gerador fica disponivel no modo antigo e bloqueia conversao e Premium', () => {
  assert.equal(
    access.generatorWriteBlocked({ maintenanceMode: 'generator' }),
    false,
  );
  assert.equal(access.generatorWriteBlocked({}), false);
  assert.equal(
    access.generatorWriteBlocked({ maintenanceMode: 'converting' }),
    true,
  );
  assert.match(
    access.generatorWriteMessage({ maintenanceMode: 'converting' }),
    /continua no ar/,
  );
  assert.equal(
    access.generatorWriteBlocked({ maintenanceMode: 'premium' }),
    true,
  );
});

await test('publicacao recusa Premium antes de consultar paginas ou gravar', async () => {
  const { tenant } = fixture();
  let touched = false;
  const { publishSite } = await loadModule('lib/sites/publish.ts', {
    '@/lib/db': {
      db: () => {
        touched = true;
        throw new Error('I/O inesperado');
      },
    },
    '@/lib/tenant-queries': {
      listPages: async () => {
        touched = true;
        return [];
      },
    },
    '@/lib/images/queries': {
      listImages: async () => {
        touched = true;
        return [];
      },
    },
  });
  const result = await publishSite({ ...tenant, maintenanceMode: 'premium' });
  assert.equal(touched, false);
  assert.equal(result.published.length, 0);
  assert.match(result.blocked[0].preflight, /code agent/);
});

await test('ponte Premium exige token valido e o host canonico do projeto', async () => {
  const { premiumBridgeProject } = await loadModule('lib/premium/bridge.ts', {
    '@/lib/premium/queries': {
      premiumProjectByToken: async (token) =>
        token === 'certo'
          ? {
              tenantId: 'tenant',
              slug: 'projeto-premium',
              canonicalHost: 'projeto-premium.eixu.com.br',
            }
          : null,
    },
  });
  const accepted = await premiumBridgeProject(
    new Request('https://eixu.com.br/api/premium/events', {
      headers: {
        authorization: 'Bearer certo',
        'x-eixu-site-host': 'projeto-premium.eixu.com.br',
      },
    }),
  );
  assert.equal(accepted?.tenantId, 'tenant');
  const refused = await premiumBridgeProject(
    new Request('https://eixu.com.br/api/premium/events', {
      headers: {
        authorization: 'Bearer certo',
        'x-eixu-site-host': 'outro.eixu.com.br',
      },
    }),
  );
  assert.equal(refused, null);
});

await test('exportador materializa um workspace isolado sem conteúdo de rascunho', async () => {
  const { tenant, page } = fixture();
  const snapshot = snapshotModule.premiumSourceSnapshot(tenant, [page]);
  const root = await mkdtemp(join(tmpdir(), 'eixu-premium-export-'));
  const input = join(root, 'job.json');
  try {
    await writeFile(
      input,
      JSON.stringify({
        id: '00000000-0000-4000-8000-000000000003',
        projectKey: tenant.slug,
        directory: `apps/premium/${tenant.slug}`,
        canonicalHost: `${tenant.slug}.eixu.com.br`,
        sourceHash: snapshotModule.premiumSourceHash(snapshot),
        sourceCommit: 'a'.repeat(40),
        converterVersion: '1',
        snapshot,
      }),
    );
    await execFileAsync(process.execPath, [
      'scripts/premium/export-project.mjs',
      '--input',
      input,
      '--output-root',
      root,
    ]);
    const project = join(root, 'apps/premium/projeto-premium');
    const [manifest, content, renderer, robots, sitemap, nextConfig] =
      await Promise.all([
        readFile(join(project, 'eixu.project.json'), 'utf8'),
        readFile(join(project, 'content/site.json'), 'utf8'),
        readFile(join(project, 'lib/blocks/render.tsx'), 'utf8'),
        readFile(join(project, 'app/robots.txt/route.ts'), 'utf8'),
        readFile(join(project, 'app/sitemap.xml/route.ts'), 'utf8'),
        readFile(join(project, 'next.config.ts'), 'utf8'),
      ]);
    assert.match(manifest, /projeto-premium\.eixu\.com\.br/);
    assert.match(content, /publicado/);
    assert.doesNotMatch(content, /rascunho|segredo/);
    assert.match(renderer, /RenderBlocks/);
    assert.match(robots, /Sitemap/);
    assert.match(sitemap, /publishedAt/);
    assert.match(nextConfig, /favicon\.ico/);
    assert.match(nextConfig, /png32/);

    await Promise.all([
      mkdir(join(project, '.next'), { recursive: true }),
      mkdir(join(project, 'node_modules/example'), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(
        join(project, '.next/cache.json'),
        'https://assets.test/nao-incluir-next.webp',
      ),
      writeFile(
        join(project, 'node_modules/example/package.json'),
        'https://assets.test/nao-incluir-dependencia.webp',
      ),
    ]);
    const release = await execFileAsync(
      process.execPath,
      [
        join(process.cwd(), 'scripts/premium/release-manifest.mjs'),
        '--project',
        'apps/premium/projeto-premium',
      ],
      { cwd: root },
    );
    const releaseManifest = JSON.parse(release.stdout);
    assert.equal(releaseManifest.project.projectKey, 'projeto-premium');
    assert.ok(releaseManifest.assets.includes('https://assets.test/foto.webp'));
    assert.ok(releaseManifest.assets.includes('https://assets.test/logo.svg'));
    assert.equal(
      releaseManifest.assets.some((url) => url.includes('nao-incluir')),
      false,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function releaseFixture({
  projectStatus,
  tenantStatus = 'published',
  maintenanceMode,
  conversionStatus,
}) {
  const queries = [];
  const connection = {
    async query(sql, values = []) {
      queries.push({ sql, values });
      if (sql.includes('select * from premium_projects'))
        return {
          rows: [
            {
              id: 'project-id',
              tenant_id: 'tenant-id',
              status: projectStatus,
            },
          ],
        };
      if (sql.includes('select status, maintenance_mode'))
        return {
          rows: [
            {
              status: tenantStatus,
              maintenance_mode: maintenanceMode,
            },
          ],
        };
      if (sql.includes('select id from premium_conversions'))
        return { rows: [{ id: 'conversion-id', status: conversionStatus }] };
      if (sql.includes('insert into premium_releases'))
        return { rows: [{ id: 'release-id' }] };
      return { rows: [] };
    },
  };
  const premium = await loadModule('lib/premium/queries.ts', {
    '@/lib/db': {
      db: () => {
        throw new Error('HTTP DB inesperado');
      },
      transaction: async (run) => run(connection),
    },
  });
  const activated = await premium.activatePremiumRelease({
    conversionId: '00000000-0000-4000-8000-000000000003',
    projectKey: 'projeto-premium',
    commitSha: 'b'.repeat(40),
    deploymentId: `dpl-${projectStatus}`,
    deploymentUrl: 'https://projeto-premium.vercel.app',
    vercelProjectId: 'prj-premium',
    manifest: { assets: [] },
  });
  return { activated, queries };
}

await test('primeira ativação vincula a conversão e releases seguintes não a reutilizam', async () => {
  const first = await releaseFixture({
    projectStatus: 'preparing',
    maintenanceMode: 'converting',
    conversionStatus: 'deploying',
  });
  const next = await releaseFixture({
    projectStatus: 'active',
    maintenanceMode: 'premium',
    conversionStatus: 'activated',
  });
  assert.equal(first.activated, true);
  assert.equal(next.activated, true);
  const firstInsert = first.queries.find((query) =>
    query.sql.includes('insert into premium_releases'),
  );
  const nextInsert = next.queries.find((query) =>
    query.sql.includes('insert into premium_releases'),
  );
  assert.equal(firstInsert.values[1], '00000000-0000-4000-8000-000000000003');
  assert.equal(nextInsert.values[1], null);
});

await test('ativação recusa tenant arquivado antes de criar release', async () => {
  const result = await releaseFixture({
    projectStatus: 'preparing',
    tenantStatus: 'archived',
    maintenanceMode: 'converting',
    conversionStatus: 'deploying',
  });
  assert.equal(result.activated, false);
  assert.equal(
    result.queries.some((query) =>
      query.sql.includes('insert into premium_releases'),
    ),
    false,
  );
});

await test('schema e release preservam pasta propria e URL canonica', async () => {
  const [schema, release] = await Promise.all([
    readFile('db/schema.sql', 'utf8'),
    readFile('.github/workflows/premium-release.yml', 'utf8'),
  ]);
  assert.match(schema, /create table if not exists premium_projects/);
  assert.match(
    schema,
    /maintenance_mode in \('generator', 'converting', 'premium'\)/,
  );
  assert.match(schema, /premium_conversions_active_tenant_idx/);
  assert.match(release, /apps\/premium\/\$\{key\}/);
  assert.match(release, /vercel alias set "\$deployment_url" "\$host"/);
  assert.match(release, /api\/internal\/premium\/releases/);
});
