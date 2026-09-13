import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
import { loadModule } from './helpers/load-module.mjs';
import {
  direction,
  reading,
  referenceDirection,
  referenceTenant,
  url,
} from './helpers/reference-fixture.mjs';

const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
const { designSchemaFor } = await j.import('../lib/design/profile.ts');
const { landingInput } = await j.import('./helpers/landing-data.ts');
const { phaseInstructions } = await j.import('../lib/generation/context.ts');
const { currentSitePrompt } = await j.import('../lib/current-site/schema.ts');
const { sourceContextText } = await j.import('../lib/ai/source-context.ts');
const { intakeFromForm } = await j.import('../lib/admin/tenant-input.ts');
const currentUrl = 'https://cliente.test/';
const receipt = () => ({
  version: 'current-site-v1',
  scanId: '11111111-1111-4111-8111-111111111111',
  url: currentUrl,
  status: 'ok',
  crawledAt: new Date().toISOString(),
  pages: [],
  links: [],
  imagesDiscovered: 0,
  importedImages: [],
  imageFailures: [],
  limits: [],
  renderedPages: 0,
  analysisStatus: 'ok',
  analysis: {
    identity: {
      matches: true,
      confidence: 'high',
      reason: 'Nome e atividade conferem.',
    },
    overview: 'A oficina produz móveis sob medida para residências.',
    offers: [{ text: 'Móveis sob medida', sourceUrl: currentUrl }],
    audiences: [],
    regions: [],
    differentiators: [],
    evidence: [],
    callsToAction: [],
    pageInsights: [],
    usefulLinks: [],
    selectedImages: [],
    conflicts: [],
    gaps: [],
  },
});
async function fixture({
  current = false,
  visual = false,
  shape = 'multi',
  result = receipt(),
  visualResult,
  saved = true,
} = {}) {
  const tenant = referenceTenant();
  tenant.brand.vibe = shape === 'landing' ? 'landing' : 'artistico';
  tenant.brief = {
    intake: {
      story:
        'A oficina produz móveis sob medida para residências. O objetivo é receber pedidos de projeto.',
      currentSiteUrl: current ? currentUrl : '',
      references: visual ? [url] : [],
    },
  };
  const calls = { current: 0, visual: 0, text: 0, writes: [] };
  const { buildTools } = await loadModule('lib/ai/tools.ts', {
    '@/lib/db': {
      db:
        () =>
        async (parts, ...values) => {
          const sql = parts.join('?');
          calls.writes.push({ sql, values });
          if (sql.includes("'{currentSite}'"))
            tenant.brief.currentSite = JSON.parse(values[0]);
          if (sql.includes("'{sources}'"))
            tenant.brief.sources = JSON.parse(values[1]);
          if (sql.includes('brief = brief ||')) {
            Object.assign(tenant.brief, JSON.parse(values[0]));
            Object.assign(tenant.brand, JSON.parse(values[1]));
          }
          return sql.includes('returning id') && saved
            ? [{ id: tenant.id }]
            : [];
        },
    },
    '@/lib/current-site/read': {
      readCurrentSite: async () => {
        calls.current++;
        await new Promise((r) => setImmediate(r));
        return result;
      },
    },
    '@/lib/references/read': {
      readReferenceVisual: async () => {
        calls.visual++;
        return (
          visualResult ?? {
            status: 'ok',
            capturedAt: new Date().toISOString(),
            reading,
          }
        );
      },
    },
    '@/lib/ai/reference': {
      readReference: async () => {
        calls.text++;
        throw new Error('O texto desta referência não está acessível');
      },
    },
  });
  const input = designSchemaFor(tenant.brand.vibe).parse({
    ...(shape === 'landing'
      ? landingInput()
      : {
          ...direction,
          bodyFont: 'editorial',
          navigation: 'floating',
          imageTreatment: 'collage',
          surfaceStyle: 'layered',
          motif: 'rings',
          variance: 6,
          motion: 5,
        }),
    ...(visual && !visualResult ? { referenceDirection } : {}),
    brief: {
      ...(shape === 'landing' ? landingInput().brief : direction.brief),
      evidence: [],
      gaps: [],
    },
  });
  return { tenant, calls, input, tools: buildTools(tenant), buildTools };
}

for (const shape of ['multi', 'landing'])
  for (const [current, visual] of [
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ]) {
    await test(`${shape}: cadastro e direção com site atual=${current}, referência=${visual}`, async () => {
      const form = new FormData();
      form.set('story', 'A oficina produz móveis sob medida para residências.');
      if (current) form.set('currentSiteUrl', currentUrl);
      if (visual) form.set('reference', url);
      assert.equal(intakeFromForm(form).success, true);
      const f = await fixture({ shape, current, visual });
      if (current)
        assert.match(
          (await f.tools.set_design.execute(f.input)).error,
          /read_current_site/,
        );
      if (current) await f.tools.read_current_site.execute({});
      if (visual) await f.tools.read_reference.execute({ url });
      const result = await f.tools.set_design.execute(f.input);
      assert.equal(result.error, undefined, JSON.stringify(result));
      assert.equal(result.visualAuthority, visual ? 'reference' : 'vibe');
      assert.deepEqual(
        [f.calls.current, f.calls.visual, f.calls.text],
        [Number(current), Number(visual), 0],
      );
      for (const phase of ['briefing', 'cenas', 'composicao']) {
        const prompt = phaseInstructions({
          tenant: f.tenant,
          pages: [],
          images: [],
          phase,
        });
        assert.match(prompt, /Ausência de link não é lacuna/);
        if (current) assert.match(prompt, /Móveis sob medida/);
        else assert.match(prompt, /Site atual não informado/);
        if (visual) assert.ok(prompt.includes(reading.layout));
        else assert.match(prompt, /Referência visual não informada/);
      }
      const prompt = phaseInstructions({
        tenant: f.tenant,
        pages: [],
        images: [],
        phase: 'briefing',
      });
      if (current) assert.match(prompt, /chame read_current_site antes/);
    });
  }

await test('site atual inacessível e referência utilizável continuam independentes', async () => {
  const f = await fixture({
    current: true,
    visual: true,
    result: {
      ...receipt(),
      status: 'inacessivel',
      motivo: 'Domínio indisponível',
      analysis: undefined,
      analysisStatus: undefined,
    },
  });
  await f.tools.read_current_site.execute({});
  await f.tools.read_reference.execute({ url });
  assert.match((await f.tools.set_design.execute(f.input)).error, /brief.gaps/);
  f.input.brief.gaps = [
    'O site atual ficou indisponível; conteúdo baseado na história.',
  ];
  assert.equal(
    (await f.tools.set_design.execute(f.input)).visualAuthority,
    'reference',
  );
});

await test('referência inacessível usa vibe sem descartar conteúdo do site atual', async () => {
  const f = await fixture({
    current: true,
    visual: true,
    visualResult: {
      status: 'inacessivel',
      motivo: 'Captura bloqueada',
      capturedAt: new Date().toISOString(),
    },
  });
  await f.tools.read_current_site.execute({});
  await f.tools.read_reference.execute({ url });
  f.input.brief.gaps = [
    'A referência visual não pôde ser vista; direção pela vibe.',
  ];
  assert.equal(
    (await f.tools.set_design.execute(f.input)).visualAuthority,
    'vibe',
  );
  assert.match(
    phaseInstructions({
      tenant: f.tenant,
      pages: [],
      images: [],
      phase: 'composicao',
    }),
    /Móveis sob medida/,
  );
});

await test('cache e chamadas concorrentes do site atual devolvem o mesmo contexto útil', async () => {
  const result = receipt();
  result.importedImages = [
    {
      id: 'photo',
      seq: 9,
      kind: 'foto',
      url: 'https://blob.test/foto.webp',
      sourceUrl: currentUrl + 'foto.jpg',
      pageUrl: currentUrl,
      alt: 'Oficina',
    },
  ];
  result.analysis.conflicts = [
    {
      topic: 'Região',
      currentSiteSays: 'Brasil inteiro',
      operatorStorySays: 'Somente Bauru',
      sourceUrl: currentUrl,
    },
  ];
  result.limits = ['Somente páginas públicas'];
  const f = await fixture({ current: true, result });
  const [a, b] = await Promise.all([
    f.tools.read_current_site.execute({}),
    f.tools.read_current_site.execute({}),
  ]);
  assert.deepEqual(a, b);
  assert.equal(f.calls.current, 1);
  assert.match(a.conteudo, /Somente Bauru/);
  assert.equal(a.ativos[0].seq, 9);
  const cached = await f.buildTools(f.tenant).read_current_site.execute({});
  assert.deepEqual(
    JSON.parse(JSON.stringify({ ...cached, cache: false })),
    JSON.parse(JSON.stringify(a)),
  );
  assert.equal(cached.cache, true);
  assert.match((await f.tools.set_design.execute(f.input)).error, /conflitos/);
});

await test('falha da síntese não importa fatos nem contatos de identidade desconhecida', () => {
  const result = receipt();
  result.analysis = undefined;
  result.analysisStatus = 'inacessivel';
  result.pages = [
    {
      url: currentUrl,
      text: 'Fabricamos helicópteros',
      phones: ['telefone-obsoleto'],
    },
  ];
  const prompt = currentSitePrompt(result);
  assert.match(
    prompt,
    /identidade e os fatos do domínio não foram verificados/,
  );
  assert.doesNotMatch(prompt, /helicópteros|telefone-obsoleto/);
});

await test('prompt exclui textos de referência, fonte visual removida e recibo de outro URL', async () => {
  const f = await fixture({ visual: true });
  f.tenant.brief.sources = [
    {
      url,
      status: 'ok',
      texto: 'Vendemos helicópteros',
      telefones: ['obsoleto'],
      visual: { status: 'ok', reading },
    },
    {
      url: 'https://removido.test/',
      texto: 'Fonte removida',
      visual: { status: 'ok', reading },
    },
  ];
  f.tenant.brief.currentSite = receipt();
  const prompt = phaseInstructions({
    tenant: f.tenant,
    pages: [],
    images: [],
    phase: 'composicao',
  });
  assert.ok(prompt.includes(reading.layout));
  assert.doesNotMatch(
    sourceContextText(f.tenant.brief),
    /helicópteros|obsoleto|removido/,
  );
  assert.doesNotMatch(prompt, /Móveis sob medida/);
});

await test('referência visual tem cache entre turnos e nova leitura descarta texto legado', async () => {
  const f = await fixture({ visual: true });
  const first = await f.tools.read_reference.execute({ url });
  f.tenant.brief.sources[0].texto = 'Oferta de outra empresa';
  const cached = await f
    .buildTools(f.tenant)
    .read_reference.execute({ url: url + '#hero' });
  assert.deepEqual(cached.visual, first.visual);
  assert.equal(cached.texto, undefined);
  assert.equal(f.calls.visual, 1);
  await f.buildTools(f.tenant).read_reference.execute({ url, refresh: true });
  assert.equal(f.calls.visual, 2);
});

await test('leitura da referência que termina após mudança do cadastro não autoriza direção', async () => {
  const f = await fixture({ visual: true, saved: false });
  assert.match(
    (await f.tools.read_reference.execute({ url })).error,
    /referência mudou/,
  );
  assert.match(
    (await f.tools.set_design.execute(f.input)).error,
    /Leia a referência/,
  );
});

await test('mesma URL pode ser conteúdo do cliente e referência visual, com leituras próprias', async () => {
  const f = await fixture({ current: true, visual: true });
  f.tenant.brief.intake.references = [currentUrl];
  const tools = f.buildTools(f.tenant);
  await tools.read_current_site.execute({});
  await tools.read_reference.execute({ url: currentUrl });
  assert.deepEqual([f.calls.current, f.calls.visual], [1, 1]);
});

await test('falha de importação preserva coleta e síntese em um recibo com a limitação', async () => {
  const schema = await j.import('../lib/current-site/schema.ts');
  const analysis = {
    ...receipt().analysis,
    selectedImages: [
      {
        url: currentUrl + 'foto.jpg',
        kind: 'photo',
        alt: 'Oficina',
        reason: 'Ambiente relacionado à empresa',
      },
    ],
  };
  const { readCurrentSite } = await loadModule('lib/current-site/read.ts', {
    './schema': schema,
    './crawl': {
      crawlCurrentSite: async () => ({
        url: currentUrl,
        finalUrl: currentUrl,
        pages: [{ url: currentUrl }],
        links: [],
        images: [
          { url: currentUrl + 'foto.jpg', pageUrl: currentUrl, role: 'photo' },
        ],
        renderedPages: 0,
        limits: [],
      }),
    },
    './analyze': { analyzeCurrentSite: async () => ({ analysis, usage: {} }) },
    './import-image': {
      importCurrentSiteImages: async () => {
        throw new Error('Biblioteca indisponível');
      },
    },
  });
  const result = await readCurrentSite({
    tenantId: 'tenant',
    tenantName: 'Oficina',
    url: currentUrl,
    operatorStory: 'Oficina',
  });
  assert.equal(result.status, 'ok');
  assert.equal(result.analysisStatus, 'ok');
  assert.equal(result.pages.length, 1);
  assert.equal(result.importedImages.length, 0);
  assert.match(result.imageFailures[0], /conteúdo coletado foi preservado/);
});

await test('leitura textual limita DNS e transporte mesmo quando ignoram o cancelamento', async () => {
  const { readReference } = await j.import('../lib/ai/reference.ts');
  // Mantém o event loop ativo enquanto AbortSignal.timeout dispara.
  const keepAlive = setInterval(() => {}, 1000);
  try {
    const dns = await readReference(url, {
      timeoutMs: 10,
      lookup: () => new Promise(() => {}),
    });
    assert.equal(dns.status, 'inacessivel');
    const transport = await readReference(url, {
      timeoutMs: 10,
      lookup: async () => ({ address: '93.184.216.34', family: 4 }),
      fetch: () => new Promise(() => {}),
    });
    assert.equal(transport.status, 'inacessivel');
    assert.equal(transport.motivo, 'Tempo esgotado');
  } finally {
    clearInterval(keepAlive);
  }
});

await test('formato enviado ao modelo simplifica restrições sem afrouxar a validação do recibo', async () => {
  const { currentSiteOutputSchema } = await j.import(
    '../lib/current-site/output-schema.ts',
  );
  const schema = currentSiteOutputSchema.jsonSchema;
  assert.equal(schema.properties.overview.maxLength, undefined);
  assert.equal(schema.properties.offers.maxItems, undefined);
  assert.match(schema.properties.overview.description, /maxLength: 1600/);
  assert.equal(schema.required.length, Object.keys(schema.properties).length);
  assert.equal(
    (await currentSiteOutputSchema.validate(receipt().analysis)).success,
    true,
  );
  for (const patch of [
    { overview: 'x'.repeat(1601) },
    {
      offers: Array.from({ length: 21 }, () => ({
        text: 'Oferta',
        sourceUrl: currentUrl,
      })),
    },
    { offers: [{ text: 'Oferta', sourceUrl: 'URL inválida' }] },
    {
      identity: {
        matches: true,
        confidence: 'inventada',
        reason: 'Sem comprovação',
      },
    },
  ])
    assert.equal(
      (
        await currentSiteOutputSchema.validate({
          ...receipt().analysis,
          ...patch,
        })
      ).success,
      false,
    );
});

await test('falhas de leitura não ficam presas no cache de 24 horas entre pedidos', async () => {
  const f = await fixture({
    current: true,
    visual: true,
    result: {
      ...receipt(),
      analysis: undefined,
      analysisStatus: 'inacessivel',
      analysisReason: 'Síntese recusada pelo provedor',
    },
    visualResult: {
      status: 'inacessivel',
      motivo: 'Texto antigo não pôde ser lido',
      capturedAt: new Date().toISOString(),
    },
  });
  await f.tools.read_current_site.execute({});
  await f.tools.read_reference.execute({ url });
  const next = f.buildTools(f.tenant);
  await next.read_current_site.execute({});
  await next.read_reference.execute({ url });
  assert.deepEqual([f.calls.current, f.calls.visual], [2, 2]);
});
