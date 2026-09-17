import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
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
const editorModule = await j.import('../lib/premium/editor.ts');
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

await test('dispatch inicia o job exato e mantém o agendamento como recuperação', async () => {
  const dispatch = await j.import('../lib/premium/dispatch.ts');
  const previousToken = process.env.GITHUB_WORKFLOW_TOKEN;
  const previousRepository = process.env.PREMIUM_GITHUB_REPOSITORY;
  const previousFetch = globalThis.fetch;
  const calls = [];
  try {
    delete process.env.GITHUB_WORKFLOW_TOKEN;
    assert.equal(
      await dispatch.dispatchPremiumConversion(
        '00000000-0000-4000-8000-000000000099',
      ),
      'scheduled',
    );
    process.env.GITHUB_WORKFLOW_TOKEN = 'segredo-de-teste';
    process.env.PREMIUM_GITHUB_REPOSITORY = 'eixu/teste';
    globalThis.fetch = async (url, init) => {
      calls.push({
        url:
          typeof url === 'string'
            ? url
            : url instanceof URL
              ? url.href
              : url.url,
        init,
      });
      return new Response(null, { status: 204 });
    };
    assert.equal(
      await dispatch.dispatchPremiumConversion(
        '00000000-0000-4000-8000-000000000099',
      ),
      'started',
    );
    assert.match(calls[0].url, /premium-conversions\.yml\/dispatches$/);
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      ref: 'main',
      inputs: {
        conversion_id: '00000000-0000-4000-8000-000000000099',
      },
    });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.GITHUB_WORKFLOW_TOKEN;
    else process.env.GITHUB_WORKFLOW_TOKEN = previousToken;
    if (previousRepository === undefined)
      delete process.env.PREMIUM_GITHUB_REPOSITORY;
    else process.env.PREMIUM_GITHUB_REPOSITORY = previousRepository;
  }
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

await test('contrato editorial valida chaves, limites e imagens do tenant', () => {
  const contract = editorModule.parsePremiumEditorContract({
    version: 1,
    pages: [
      {
        slug: '',
        label: 'Início',
        sections: [
          {
            id: 'hero',
            label: 'Abertura',
            fields: [
              {
                key: 'hero.title',
                label: 'Título',
                type: 'text',
                value: 'Título original',
                required: true,
                maxLength: 40,
              },
              {
                key: 'hero.image',
                label: 'Imagem',
                type: 'image',
                value: 'https://assets.test/original.webp',
                required: true,
              },
            ],
          },
        ],
      },
    ],
  });
  assert.ok(contract);
  assert.deepEqual(editorModule.premiumEditorDefaults(contract), {
    'hero.title': 'Título original',
    'hero.image': 'https://assets.test/original.webp',
  });
  assert.deepEqual(
    editorModule.validatePremiumEditorValues(
      contract,
      {
        'hero.title': '  Um título melhor  ',
        'hero.image': 'https://assets.test/nova.webp',
      },
      new Set(['https://assets.test/nova.webp']),
    ),
    {
      'hero.title': 'Um título melhor',
      'hero.image': 'https://assets.test/nova.webp',
    },
  );
  assert.throws(
    () =>
      editorModule.validatePremiumEditorValues(
        contract,
        {
          'hero.title': 'Título',
          'hero.image': 'https://outro.test/foto.webp',
          inesperado: 'não pode circular',
        },
        new Set(),
      ),
    (error) =>
      error instanceof editorModule.PremiumEditorError &&
      error.status === 422 &&
      Boolean(error.fields['hero.image']) &&
      Boolean(error.fields.inesperado),
  );
});

await test('publicação Premium trava contrato, conteúdo e autoria na mesma transação', async () => {
  const contract = editorModule.parsePremiumEditorContract({
    version: 1,
    pages: [
      {
        slug: '',
        label: 'Início',
        sections: [
          {
            id: 'hero',
            label: 'Abertura',
            fields: [
              {
                key: 'hero.title',
                label: 'Título',
                type: 'text',
                value: 'Original',
                required: true,
                maxLength: 80,
              },
            ],
          },
        ],
      },
    ],
  });
  assert.ok(contract);
  const hash = createHash('sha256')
    .update(JSON.stringify(contract))
    .digest('hex');
  const queries = [];
  const connection = {
    query: async (sql, params = []) => {
      queries.push({ sql, params });
      if (sql.includes('select project.id'))
        return {
          rows: [
            {
              id: 'project-1',
              editor: contract,
              revision: 2,
              content: { 'hero.title': 'Original' },
            },
          ],
        };
      if (sql.includes('select url from images')) return { rows: [] };
      if (sql.includes('insert into premium_content_revisions'))
        return {
          rows: [{ id: 'revision-3', created_at: '2026-09-16T12:00:00.000Z' }],
        };
      if (
        sql.includes('update premium_projects') ||
        sql.includes('insert into admin_activity')
      )
        return { rows: [] };
      throw new Error(`SQL inesperado: ${sql}`);
    },
  };
  const { publishPremiumContent } = await loadModule('lib/premium/content.ts', {
    '@/lib/db': {
      db: () => {
        throw new Error('consulta fora da transação');
      },
      transaction: async (run) => run(connection),
    },
  });
  const input = {
    actor: { id: 'user-1', name: 'Bia', login: 'bia' },
    tenant: { id: 'tenant-1', slug: 'atelier', name: 'Atelier' },
    expectedRevision: 2,
    schemaVersion: 1,
    contractHash: hash,
    values: { 'hero.title': 'Título atualizado' },
  };
  const published = await publishPremiumContent(input);
  assert.equal(published.revision, 3);
  assert.deepEqual(
    { ...published.values },
    {
      'hero.title': 'Título atualizado',
    },
  );
  assert.equal(queries.length, 5);
  assert.equal(queries[2].params[3], hash);
  assert.match(queries[4].sql, /insert into admin_activity/);
  assert.equal(queries[4].params[8], 'premium:content:tenant-1:3');

  const beforeStaleAttempt = queries.length;
  await assert.rejects(
    () =>
      publishPremiumContent({
        ...input,
        contractHash: '0'.repeat(64),
      }),
    (error) =>
      error?.status === 409 && /frontend Premium mudou/.test(error.message),
  );
  assert.equal(queries.length, beforeStaleAttempt + 1);
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
              projectId: 'project',
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
    const [
      manifest,
      content,
      editor,
      premiumContent,
      premiumPreview,
      renderer,
      robots,
      sitemap,
      nextConfig,
    ] = await Promise.all([
      readFile(join(project, 'eixu.project.json'), 'utf8'),
      readFile(join(project, 'content/site.json'), 'utf8'),
      readFile(join(project, 'content/editor.json'), 'utf8'),
      readFile(join(project, 'lib/premium-content.ts'), 'utf8'),
      readFile(join(project, 'app/premium-preview.tsx'), 'utf8'),
      readFile(join(project, 'lib/blocks/render.tsx'), 'utf8'),
      readFile(join(project, 'app/robots.txt/route.ts'), 'utf8'),
      readFile(join(project, 'app/sitemap.xml/route.ts'), 'utf8'),
      readFile(join(project, 'next.config.ts'), 'utf8'),
    ]);
    assert.match(manifest, /projeto-premium\.eixu\.com\.br/);
    assert.match(content, /publicado/);
    assert.doesNotMatch(content, /rascunho|segredo/);
    assert.match(editor, /page:home:block:live:body/);
    assert.match(editor, /page:home:block:live:image/);
    assert.match(premiumContent, /EIXU_PREMIUM_TOKEN/);
    assert.match(premiumPreview, /eixu:premium-preview-ready/);
    assert.match(renderer, /RenderBlocks/);
    assert.match(robots, /Sitemap/);
    assert.match(sitemap, /publishedAt/);
    assert.match(nextConfig, /favicon\.ico/);
    assert.match(nextConfig, /png32/);
    assert.match(nextConfig, /Referrer-Policy/);
    assert.match(nextConfig, /eixu_preview/);

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
    assert.equal(releaseManifest.editor.version, 1);
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

await test('schema e workflows preservam fila, pasta e URL canonica', async () => {
  const [schema, conversion, release] = await Promise.all([
    readFile('db/schema.sql', 'utf8'),
    readFile('.github/workflows/premium-conversions.yml', 'utf8'),
    readFile('.github/workflows/premium-release.yml', 'utf8'),
  ]);
  assert.match(schema, /create table if not exists premium_projects/);
  assert.match(
    schema,
    /maintenance_mode in \('generator', 'converting', 'premium'\)/,
  );
  assert.match(schema, /premium_conversions_active_tenant_idx/);
  assert.match(schema, /create table if not exists premium_content_revisions/);
  assert.match(schema, /create table if not exists premium_preview_sessions/);
  assert.match(schema, /contract_hash.*\^\[0-9a-f\]\{64\}\$/);
  assert.match(conversion, /inputs:\s+conversion_id:/);
  assert.match(conversion, /node scripts\/premium\/export-project\.mjs/);
  assert.match(conversion, /--source-root "\$source_root"/);
  assert.match(release, /apps\/premium\/\$\{key\}/);
  assert.match(release, /vercel alias set "\$deployment_url" "\$host"/);
  assert.match(release, /api\/internal\/premium\/releases/);
});
