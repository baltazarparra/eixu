import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers/load-module.mjs';

const tenant = {
  id: 'tenant-a',
  slug: 'cliente',
  name: 'Oficina',
  brand: {},
  dials: {},
  brief: {},
};
const original = {
  id: '00000000-0000-4000-8000-000000000005',
  seq: 5,
  kind: 'foto',
  url: 'https://assets.test/original.webp',
  ratio: '16:9',
  targetBlock: 'hero.editorial',
  status: 'candidata',
  critique: {},
  requestText: 'Carro na oficina',
};
const replacement = {
  ...original,
  id: '00000000-0000-4000-8000-000000000206',
  seq: 206,
  url: 'https://assets.test/nova.webp',
  status: 'disponivel',
  alt: 'Outro carro na oficina',
};
const plain = (value) => JSON.parse(JSON.stringify(value));

await test('acervo distingue uso no rascunho, no publicado e no logo sem casar texto parcial', async () => {
  const { imageUsage } = await loadModule('lib/images/usage.ts');
  const other = {
    ...original,
    id: '00000000-0000-4000-8000-000000000006',
    seq: 6,
    url: 'https://assets.test/outra.webp',
  };
  const dark = {
    ...original,
    id: '00000000-0000-4000-8000-000000000007',
    seq: 7,
    url: 'https://assets.test/branca.png',
  };
  const client = {
    ...tenant,
    brand: { logoUrl: other.url, logoDarkUrl: dark.url },
    publishedSnapshot: { brand: { logoUrl: original.url } },
  };
  const pages = [
    {
      id: 'home',
      slug: '',
      blocks: [
        {
          id: 'hero',
          type: 'hero.split',
          props: {
            image: original.url,
            body: `Referência textual: ${other.url}`,
          },
        },
      ],
      publishedBlocks: [
        {
          id: 'galeria',
          type: 'media.gallery',
          props: { items: [{ src: other.url }] },
        },
      ],
    },
  ];
  const usage = plain(imageUsage(client, pages, [original, other]));
  assert.deepEqual(usage[original.id], [
    { scope: 'published', page: null, block: null, kind: 'logo' },
    { scope: 'draft', page: '/', block: 'hero', kind: 'page' },
  ]);
  assert.deepEqual(usage[other.id], [
    { scope: 'draft', page: null, block: null, kind: 'logo' },
    { scope: 'published', page: '/', block: 'galeria', kind: 'page' },
  ]);
});

await test('alteração usa os pixels da #5, mantém o recorte e continua disponível com crítica negativa', async () => {
  const calls = [];
  const bytes = Buffer.from('fixture');
  const { reviseImage } = await loadModule('lib/images/revise.ts', {
    '@/lib/images/queries': {
      getGuide: async (id) => {
        assert.equal(id, tenant.id);
        return { estilo: 'fotografia' };
      },
    },
    '@/lib/images/logo': {
      fetchReference: async (url) => {
        assert.equal(url, original.url);
        return bytes;
      },
    },
    '@/lib/images/generate': {
      generateCandidates: async (input) => {
        calls.push(input);
        return { images: [{ ...replacement, bytes }], failures: [] };
      },
    },
    '@/lib/images/critic': {
      critique: async () => ({
        nota: 4,
        aprovado: false,
        alt_sugerido: replacement.alt,
        problemas: ['Reflexo incoerente'],
      }),
    },
  });
  const image = await reviseImage(tenant, original, 'quero outro carro');
  assert.equal(image.status, 'disponivel');
  assert.equal(image.seq, 206);
  assert.equal(image.score, 4);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].reference, bytes);
  assert.equal(calls[0].referenceUrl, original.url);
  assert.equal(calls[0].ratio, original.ratio);
  assert.equal(calls[0].targetBlock, original.targetBlock);
  assert.match(calls[0].request, /quero outro carro/);
  await reviseImage(
    tenant,
    { ...original, model: 'upload', ratio: '3:2' },
    'quero outro carro',
  );
  assert.equal(calls[1].reference, bytes);
  assert.equal(
    calls[1].ratio,
    '4:3',
    'upload fora dos recortes do gerador usa o mais próximo',
  );
  assert.equal(original.seq, 5);
});

await test('troca URL exata e alt em hero, galeria e abas, preservando texto e links', async () => {
  const { replaceImageInBlocks } = await loadModule(
    'lib/images/replacement.ts',
    { '@/lib/db': {} },
  );
  const blocks = [
    {
      id: 'hero',
      type: 'hero.split',
      props: {
        image: original.url,
        imageAlt: 'Carro antigo',
        secondaryImage: original.url,
        secondaryImageAlt: 'Detalhe antigo',
        body: original.url,
        cta: { href: original.url },
        items: [
          { src: original.url, alt: 'Antiga' },
          { image: original.url, imageAlt: 'Antiga' },
          { image: `${original.url}?other=1` },
        ],
      },
    },
  ];
  const before = JSON.stringify(blocks);
  const result = replaceImageInBlocks(blocks, original.url, replacement);
  assert.equal(result.changed, true);
  const props = result.blocks[0].props;
  assert.equal(props.image, replacement.url);
  assert.equal(props.imageAlt, replacement.alt);
  assert.equal(props.secondaryImageAlt, replacement.alt);
  assert.equal(props.items[0].src, replacement.url);
  assert.equal(props.items[0].alt, replacement.alt);
  assert.equal(props.items[1].image, replacement.url);
  assert.equal(props.items[2].image, `${original.url}?other=1`);
  assert.equal(props.body, original.url);
  assert.equal(props.cta.href, original.url);
  assert.equal(JSON.stringify(blocks), before);
  assert.equal(
    replaceImageInBlocks(blocks, 'https://assets.test/absent.webp', replacement)
      .changed,
    false,
  );
});

await test('troca relê páginas sob lock e grava apenas rascunhos do tenant, preservando snapshot e alterações recentes', async () => {
  const draft = [
    {
      id: 'hero',
      type: 'hero.split',
      props: {
        image: original.url,
        headline: 'Texto editado enquanto a imagem era gerada',
      },
    },
  ];
  const published = structuredClone(draft);
  const queries = [];
  const { replaceDraftImage } = await loadModule('lib/images/replacement.ts', {
    '@/lib/db': {
      transaction: async (run) =>
        run({
          query: async (sql, values) => {
            queries.push({ sql, values });
            if (sql.startsWith('select id, url'))
              return { rows: [original, replacement] };
            if (sql.startsWith('select id, slug'))
              return {
                rows: [
                  {
                    id: 'home',
                    slug: '',
                    blocks: draft,
                    published_blocks: published,
                  },
                  { id: 'unrelated', slug: 'contato', blocks: [] },
                ],
              };
            return { rows: [] };
          },
        }),
    },
  });
  assert.deepEqual(
    plain(await replaceDraftImage(tenant.id, original, replacement)),
    ['/'],
  );
  const read = queries.find((query) => query.sql.startsWith('select id, slug'));
  assert.match(read.sql, /tenant_id = \$1.*for update/);
  assert.equal(read.values[0], tenant.id);
  const writes = queries.filter((query) => query.sql.startsWith('update'));
  assert.equal(writes.length, 1);
  assert.doesNotMatch(writes[0].sql, /published|brand|seo/);
  assert.deepEqual(plain(writes[0].values.slice(1)), [tenant.id, 'home']);
  assert.equal(
    JSON.parse(writes[0].values[0])[0].props.headline,
    draft[0].props.headline,
  );
  assert.equal(JSON.parse(writes[0].values[0])[0].props.image, replacement.url);
  assert.equal(published[0].props.image, original.url);
});

await test('troca recusa imagem fora do tenant antes de ler ou gravar páginas', async () => {
  let calls = 0;
  const { replaceDraftImage } = await loadModule('lib/images/replacement.ts', {
    '@/lib/db': {
      transaction: async (run) =>
        run({
          query: async (_sql, values) => {
            calls += 1;
            assert.equal(values[0], tenant.id);
            return { rows: [replacement] };
          },
        }),
    },
  });
  await assert.rejects(
    () => replaceDraftImage(tenant.id, original, replacement),
    /neste cliente/,
  );
  assert.equal(calls, 1);
});

async function toolFixture({ missing = false, failure = false } = {}) {
  const calls = [];
  const { buildTools } = await loadModule('lib/ai/tools.ts', {
    '@/lib/images/queries': {
      getImageByNumber: async (id, number) => {
        calls.push(['lookup', id, number]);
        return missing ? null : original;
      },
      getImage: async () => {
        throw new Error('Número não deve ser consultado como UUID');
      },
      listImages: async () => [],
    },
    '@/lib/images/generation-lock': {
      withSceneGenerationLock: async (id, run) => {
        assert.equal(id, tenant.id);
        return run();
      },
    },
    '@/lib/images/revise': {
      reviseImage: async (client, image, request) => {
        calls.push(['generate', client.id, image.seq, request]);
        if (failure) throw new Error('Falha sintética da imagem');
        return replacement;
      },
    },
    '@/lib/images/replacement': {
      replaceDraftImage: async (id, old, next) => {
        calls.push(['replace', id, old.seq, next.seq]);
        return ['/'];
      },
    },
  });
  return { tool: buildTools(tenant).update_image, calls };
}

await test('ferramenta resolve #5 mesmo fora das 200 recentes e aplica a nova versão sem aprovação', async () => {
  const { tool, calls } = await toolFixture();
  const result = await tool.execute({
    image: '#5',
    request: 'quero outro carro',
  });
  assert.equal(result.ok, true);
  assert.equal(result.anterior, '#5');
  assert.equal(result.numero, '#206');
  assert.equal(result.url, replacement.url);
  assert.deepEqual(calls, [
    ['lookup', tenant.id, 5],
    ['generate', tenant.id, 5, 'quero outro carro'],
    ['replace', tenant.id, 5, 206],
  ]);
});

await test('imagem ausente ou falha de geração não altera páginas', async () => {
  for (const options of [{ missing: true }, { failure: true }]) {
    const { tool, calls } = await toolFixture(options);
    const result = await tool.execute({
      image: '#5',
      request: 'quero outro carro',
    });
    assert.ok(result.error);
    assert.equal(
      calls.some((call) => call[0] === 'replace'),
      false,
    );
    if (options.missing)
      assert.equal(
        calls.some((call) => call[0] === 'generate'),
        false,
      );
  }
});

await test('preparação entrega URL imediatamente, inclusive quando a crítica recomenda ajuste', async () => {
  const { prepareSiteImages } = await loadModule('lib/images/site-assets.ts', {
    '@/lib/images/queries': {
      getGuide: async () => ({ estilo: 'fotografia' }),
    },
    '@/lib/images/generate': {
      generateCandidates: async () => ({
        images: [replacement],
        failures: ['Outra cena falhou'],
      }),
    },
    '@/lib/images/critic': {
      critique: async () => ({ nota: 3, aprovado: false }),
    },
  });
  const result = await prepareSiteImages(tenant, [
    {
      request: 'Carro',
      ratio: '16:9',
      targetBlock: 'hero.editorial',
      role: 'hero',
    },
  ]);
  assert.equal(result.imagens[0].url, replacement.url);
  assert.equal(result.imagens[0].status, 'disponivel');
  assert.equal(result.imagens[0].recomendacao, 'regerar');
  assert.equal(result.falhas.length, 1);
});

await test('API mantém sessão e recusa tentativas de reintroduzir aprovação por PATCH', async () => {
  let authenticated = false;
  let writes = 0;
  const route = await loadModule('app/api/admin/[tenant]/images/route.ts', {
    '@/lib/auth': { isAuthenticated: async () => authenticated },
    '@/lib/tenant-queries': { getTenantBySlug: async () => tenant },
    '@/lib/images/queries': {
      updateImageMetadata: async () => {
        writes += 1;
        return replacement;
      },
    },
  });
  const context = { params: Promise.resolve({ tenant: tenant.slug }) };
  const request = (body) =>
    new Request('https://app.test/api/admin/cliente/images', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  assert.equal(
    (await route.PATCH(request({ id: original.id, alt: 'Carro' }), context))
      .status,
    401,
  );
  authenticated = true;
  assert.equal(
    (
      await route.PATCH(
        request({ id: original.id, alt: 'Carro', status: 'aprovada' }),
        context,
      )
    ).status,
    400,
  );
  assert.equal(writes, 0);
  assert.equal(
    (await route.PATCH(request({ id: original.id, alt: 'Carro' }), context))
      .status,
    200,
  );
  assert.equal(writes, 1);
});

await test('modernizar sem anexo usa o master atual e só falha quando não há logo', async () => {
  let received;
  const toolsModule = await loadModule('lib/ai/tools.ts', {
    '@/lib/images/logo': {
      fetchReference: async (url) => {
        received = url;
        return Buffer.from('master');
      },
      generateLogoCandidates: async () => ({
        images: [
          {
            id: 'logo',
            seq: 10,
            url: 'https://assets.test/new.png',
            variant: 'fiel',
            bytes: Buffer.from('logo'),
          },
        ],
        failures: [],
      }),
    },
    '@/lib/images/queries': { getGuide: async () => ({}) },
    '@/lib/images/logo-critic': {
      critiqueLogo: async () => ({ aprovado: true, nota: 8 }),
    },
  });
  const { logoAssetFor } = await import('./helpers/logo-fixture.mjs');
  const url = 'https://assets.test/brand.png';
  const asset = logoAssetFor(url);
  const tools = toolsModule.buildTools({
    ...tenant,
    brand: { logoUrl: url, logoAsset: asset },
  });
  const input = tools.generate_logo.inputSchema.parse({
    mode: 'modernizar',
    wordmark: true,
    variants: 1,
  });
  const output = await tools.generate_logo.execute(input);
  assert.equal(output.error, undefined);
  assert.equal(received, asset.master.url);
  const missing = toolsModule.buildTools({ ...tenant, brand: {} });
  assert.match(
    (
      await missing.generate_logo.execute({
        mode: 'modernizar',
        wordmark: true,
        variants: 2,
      })
    ).error,
    /ainda não tem logo/,
  );
});

await test('logo usa tela por tipo e prompt que preenche a área útil', async () => {
  const { logoDimensions, composeLogoPrompt } =
    await loadModule('lib/images/logo.ts');
  assert.equal(logoDimensions(true).size, '1536x1024');
  assert.equal(logoDimensions(false).size, '1024x1024');
  assert.match(
    composeLogoPrompt({
      tenant,
      guide: {},
      brandName: 'Marca',
      wordmark: true,
      variant: 'fiel',
    }),
    /80%/,
  );
});

await test('o crítico recebe os mesmos bytes do master gravado na biblioteca', async () => {
  const stored = Buffer.from('master final gravado');
  const { generateLogoCandidates } = await loadModule('lib/images/logo.ts', {
    ai: {
      generateImage: async () => ({
        image: { uint8Array: Buffer.from('gerado') },
        warnings: [],
      }),
    },
    '@/lib/images/logo-asset': {
      cleanLogo: async () => ({ master: Buffer.from('primeiro recorte') }),
      prepareLogoRendition: async () => ({
        master: stored,
        rendition: {
          master: {
            url: 'https://assets.test/final.png',
            width: 600,
            height: 150,
          },
        },
      }),
    },
    '@/lib/blob/tenant-files': {
      putTenantBlob: async () => ({ url: 'https://assets.test/primeiro.png' }),
    },
    '@/lib/images/queries': {
      insertImage: async (image) => ({ ...image, id: 'logo', seq: 1 }),
    },
  });
  const result = await generateLogoCandidates({
    tenant,
    guide: {},
    mode: 'criar',
    brandName: 'Marca',
    wordmark: true,
    variants: 1,
  });
  assert.equal(result.failures.length, 0);
  assert.equal(result.images[0].url, 'https://assets.test/final.png');
  assert.equal(
    Buffer.from(result.images[0].bytes).toString(),
    stored.toString(),
  );
});
