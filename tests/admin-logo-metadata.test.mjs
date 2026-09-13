import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers/load-module.mjs';
import { logoAssetFor } from './helpers/logo-fixture.mjs';

const old = 'https://assets.test/old.png',
  fresh = 'https://assets.test/fresh.png';
const brand = {
  logoUrl: fresh,
  logoAsset: logoAssetFor(fresh),
  paper: '#faf5ed',
  ink: '#161b22',
};
const published = {
  ...brand,
  logoUrl: old,
  logoAsset: {
    ...logoAssetFor(old),
    og: { url: 'https://assets.test/old-og.png', width: 1200, height: 630 },
  },
};
const tenant = {
  id: 'tenant-1',
  slug: 'demo',
  name: 'Rascunho',
  locale: 'pt-BR',
  brand,
  brief: {},
  contacts: {},
  publishedSnapshot: {
    brand: published,
    name: 'Publicado',
    locale: 'pt-BR',
    contacts: {},
  },
};
const page = {
  id: 'home',
  slug: '',
  title: 'Rascunho',
  type: 'page',
  meta: {},
  seo: { title: 'Novo' },
  publishedSeo: { title: 'Público' },
  publishedTitle: 'Publicado',
  publishedMeta: {},
  blocks: [
    { type: 'nav.bar', props: { presentation: { background: '#224466' } } },
  ],
  publishedBlocks: [{ type: 'nav.bar', props: { layout: 'contrast' } }],
};
const props = (preview = false) => ({
  params: Promise.resolve({ tenant: 'demo' }),
  searchParams: Promise.resolve(preview ? { preview: '1' } : {}),
});

async function fixture({ client = tenant, home = page, auth = true } = {}) {
  const mocks = {
    '@/lib/tenant-queries': {
      getTenantBySlug: async () => client,
      getPage: async () => home,
    },
    '@/lib/auth': { isAuthenticated: async () => auth },
    '@/lib/blocks/render': { RenderBlocks: () => null },
    '@/lib/blocks/inline-editor-loader': { InlineEditorLoader: () => null },
    'next/headers': {
      headers: async () => new Headers({ host: 'demo.localhost:3000' }),
    },
    'next/navigation': {
      notFound: () => {
        throw new Error('NOT_FOUND');
      },
    },
  };
  return {
    mocks,
    module: await loadModule(
      'app/(sites)/s/[tenant]/[[...slug]]/page.tsx',
      mocks,
    ),
  };
}

await test('metadata, viewport e JSON-LD seguem o snapshot público e o rascunho autenticado', async () => {
  const f = await fixture();
  const metadata = await f.module.generateMetadata(props());
  assert.equal(metadata.title, 'Público');
  assert.equal(metadata.openGraph.siteName, 'Publicado');
  assert.equal(
    metadata.openGraph.images[0].url,
    'https://assets.test/old-og.png',
  );
  assert.equal(metadata.openGraph.url, 'http://demo.localhost:3000/');
  assert.equal(metadata.icons.icon[0].type, 'image/svg+xml');
  assert.equal(metadata.icons.apple[0].sizes, '180x180');
  assert.equal(metadata.twitter.card, 'summary_large_image');
  assert.equal(metadata.manifest, '/manifest.webmanifest');
  assert.equal(
    (await f.module.generateViewport(props())).themeColor,
    published.ink,
  );
  const draft = await f.module.generateMetadata(props(true));
  assert.equal(draft.openGraph.images[0].url, brand.logoAsset.og.url);
  assert.equal(draft.robots.index, false);
  assert.equal(
    (await f.module.generateViewport(props(true))).themeColor,
    '#224466',
  );
  const { structuredData } = await loadModule('lib/sites/structured-data.ts');
  const graph = structuredData(
    { ...tenant, brand: published },
    page,
    false,
    'https://demo.test',
  )['@graph'];
  assert.equal(graph[0].logo, published.logoAsset.icon.png512);
  assert.equal(graph[0].url, 'https://demo.test');
});

await test('asset antigo ou incompleto não produz ícones; preview sem sessão é recusado', async () => {
  const f = await fixture({
    client: {
      ...tenant,
      publishedSnapshot: {
        ...tenant.publishedSnapshot,
        brand: { ...brand, logoUrl: old },
      },
    },
  });
  const metadata = await f.module.generateMetadata(props());
  assert.equal(metadata.icons, undefined);
  assert.equal(metadata.manifest, undefined);
  assert.equal(metadata.openGraph.images, undefined);
  assert.equal(metadata.twitter.card, 'summary');
  const denied = await fixture({ auth: false });
  await assert.rejects(
    () => denied.module.generateMetadata(props(true)),
    /NOT_FOUND/,
  );
  await assert.rejects(
    () => denied.module.generateViewport(props(true)),
    /NOT_FOUND/,
  );
});

await test('manifest e favicon expõem só snapshot publicado, com headers e fallback sem asset', async () => {
  const f = await fixture();
  for (const [path, status] of [
    ['manifest.webmanifest', 200],
    ['favicon.ico', 302],
  ]) {
    const route = await loadModule(
      `app/(sites)/s/[tenant]/${path}/route.ts`,
      f.mocks,
    );
    const response = await route.GET(
      new Request(`http://demo.test/${path}`),
      props(),
    );
    assert.equal(response.status, status);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=600');
    if (status === 302)
      assert.equal(
        response.headers.get('location'),
        published.logoAsset.icon.png32,
      );
    else {
      assert.equal(
        response.headers.get('content-type'),
        'application/manifest+json',
      );
      const manifest = await response.json();
      assert.equal(manifest.name, 'Publicado');
      assert.equal(manifest.theme_color, published.ink);
      assert.equal(manifest.icons[2].purpose, 'maskable');
    }
  }
  const absent = await fixture({
    client: {
      ...tenant,
      publishedSnapshot: { ...tenant.publishedSnapshot, brand: {} },
    },
  });
  const favicon = await loadModule(
    'app/(sites)/s/[tenant]/favicon.ico/route.ts',
    absent.mocks,
  );
  const response = await favicon.GET(
    new Request('http://demo.test/favicon.ico'),
    props(),
  );
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('x-robots-tag'), 'noindex');
  const manifest = await loadModule(
    'app/(sites)/s/[tenant]/manifest.webmanifest/route.ts',
    absent.mocks,
  );
  assert.deepEqual(
    (
      await (
        await manifest.GET(
          new Request('http://demo.test/manifest.webmanifest'),
          props(),
        )
      ).json()
    ).icons,
    [],
  );
});

await test('proxy encaminha favicon do cliente e preserva o domínio principal', async () => {
  const { NextRequest } = await import('next/server.js');
  const { proxy, config } = await loadModule('proxy.ts');
  assert.match('/favicon.ico', new RegExp(config.matcher[0]));
  const customer = proxy(
    new NextRequest('https://demo.eixu.com.br/favicon.ico', {
      headers: { host: 'demo.eixu.com.br' },
    }),
  );
  assert.match(
    customer.headers.get('x-middleware-rewrite'),
    /\/s\/demo\/favicon.ico$/,
  );
  const root = proxy(
    new NextRequest('https://eixu.com.br/favicon.ico', {
      headers: { host: 'eixu.com.br' },
    }),
  );
  assert.equal(root.headers.get('x-middleware-rewrite'), null);
});
