import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers/load-module.mjs';

const archived = {
  id: 'tenant-archived',
  slug: 'fixture',
  status: 'archived',
  whatsapp: '5511999990000',
  contacts: { phones: [], addresses: [], social: [] },
};

const unavailableQueries = {
  getTenantBySlug: async () => archived,
  getPage: async () => assert.fail('Site arquivado não deve consultar página.'),
  listPublishedPages: async () =>
    assert.fail('Site arquivado não deve montar sitemap.'),
};

await test('site arquivado responde 404 no público e mantém a prévia autenticada', async () => {
  const tenant = {
    ...archived,
    name: 'Fixture',
    locale: 'pt-BR',
    brand: {},
    brief: {},
  };
  const page = {
    id: 'page-home',
    slug: '',
    title: 'Prévia preservada',
    type: 'page',
    meta: {},
    seo: {},
    blocks: [],
    publishedBlocks: [],
    publishedSeo: {},
  };
  const { generateMetadata } = await loadModule(
    'app/(sites)/s/[tenant]/[[...slug]]/page.tsx',
    {
      '@/lib/tenant-queries': {
        getTenantBySlug: async () => tenant,
        getPage: async () => page,
      },
      '@/lib/auth': { isAuthenticated: async () => true },
      '@/lib/blocks/render': { RenderBlocks: () => null },
      '@/lib/blocks/inline-editor-loader': { InlineEditorLoader: () => null },
      'next/headers': {
        headers: async () => new Headers({ host: 'fixture.localhost:3000' }),
      },
      'next/navigation': {
        notFound: () => {
          throw new Error('NOT_FOUND');
        },
      },
    },
  );
  const params = Promise.resolve({ tenant: 'fixture' });
  await assert.rejects(
    () => generateMetadata({ params, searchParams: Promise.resolve({}) }),
    /NOT_FOUND/,
  );
  const preview = await generateMetadata({
    params,
    searchParams: Promise.resolve({ preview: '1' }),
  });
  assert.equal(preview.title, 'Prévia preservada');
  assert.equal(preview.robots.index, false);
});

await test('site arquivado não recebe formulário nem telemetria', async () => {
  const writes = [];
  const db =
    () =>
    async (...query) =>
      writes.push(query);
  const { POST: submitForm } = await loadModule('app/api/form/route.ts', {
    '@/lib/db': { db },
    '@/lib/tenant-queries': unavailableQueries,
  });
  const form = new FormData();
  form.set('tenant', 'fixture');
  form.set('nome', 'Visitante');
  const formResponse = await submitForm(
    new Request('https://fixture.eixu.com.br/api/form', {
      method: 'POST',
      body: form,
    }),
  );
  assert.equal(formResponse.status, 404);

  const { POST: track } = await loadModule('app/api/e/route.ts', {
    '@/lib/db': { db },
    '@/lib/tenant-queries': unavailableQueries,
  });
  const eventResponse = await track(
    new Request('https://fixture.eixu.com.br/api/e', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenant: 'fixture', type: 'page_view' }),
    }),
  );
  assert.equal(eventResponse.status, 204);
  assert.equal(writes.length, 0);
});

await test('site arquivado não redireciona para WhatsApp', async () => {
  const { GET } = await loadModule('app/go/wa/route.ts', {
    '@/lib/db': {
      db: () => async () => assert.fail('Não deve registrar evento.'),
    },
    '@/lib/tenant-queries': unavailableQueries,
    '@/lib/tenant-host': { tenantFromHost: () => 'fixture' },
  });
  const response = await GET(new Request('https://fixture.eixu.com.br/go/wa'));
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('x-robots-tag'), 'noindex');
});

for (const [name, file] of [
  ['robots', 'app/(sites)/s/[tenant]/robots.txt/route.ts'],
  ['sitemap', 'app/(sites)/s/[tenant]/sitemap.xml/route.ts'],
  ['manifesto', 'app/(sites)/s/[tenant]/manifest.webmanifest/route.ts'],
  ['favicon', 'app/(sites)/s/[tenant]/favicon.ico/route.ts'],
])
  await test(`${name} de site arquivado responde 404`, async () => {
    const { GET } = await loadModule(file, {
      '@/lib/tenant-queries': unavailableQueries,
    });
    const response = await GET(
      new Request(`https://fixture.eixu.com.br/${name}`),
      { params: Promise.resolve({ tenant: 'fixture' }) },
    );
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex');
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
