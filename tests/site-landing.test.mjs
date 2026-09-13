import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadModule } from './helpers/load-module.mjs';
const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  jsx: { runtime: 'automatic' },
  fsCache: false,
});
const { landingFixture, landingInput } = await j.import(
  './helpers/landing-data.ts',
);
const { lintSite } = await j.import('../lib/taste/site.ts');
const { lintPage } = await j.import('../lib/taste/lint.ts');
const { designSchemaFor, isDesignProfile } = await j.import(
  '../lib/design/profile.ts',
);
const { laneIssues, siteShape, renderingVibeOf } = await j.import(
  '../lib/design/vibes.ts',
);
const { generationState, plannedScenes } = await j.import(
  '../lib/sites/generation.ts',
);
const { systemPrompt } = await j.import('../lib/taste/prompt.ts');
const { RenderBlocks } = await j.import('../lib/blocks/render.tsx');
const { blockSchemas } = await j.import('../lib/blocks/registry.ts');
const rules = (f) =>
  lintSite(f.pages, f.images, 'publish', f.tenant.brand, f.tenant.brief);
const find = (f, type) => f.pages[0].blocks.find((b) => b.type === type);

for (const layout of ['stage', 'form'])
  await test(`landing ${layout}: schema, conteúdo, SSR, cenas e conclusão em uma página`, () => {
    const f = landingFixture(layout);
    assert.equal(siteShape(f.tenant.brand), 'landing');
    assert.equal(isDesignProfile(f.tenant.brand.design), true);
    assert.equal(renderingVibeOf(f.tenant.brand), 'landing');
    assert.deepEqual(laneIssues('landing', f.input), []);
    assert.deepEqual(
      rules(f).filter((v) => v.level === 'error'),
      [],
    );
    for (const page of f.pages)
      assert.deepEqual(
        lintPage(page, f.tenant.brand.design).filter(
          (v) => v.level === 'error',
        ),
        [],
      );
    assert.equal(generationState(f.tenant, f.pages, f.images).next, 'pronto');
    assert.equal(plannedScenes(f.tenant).length, 5);
    assert.ok(
      plannedScenes(f.tenant).every(
        (s) => s.page === '' && s.role !== 'subpagina',
      ),
    );
    const html = renderToStaticMarkup(
      createElement(RenderBlocks, {
        blocks: f.pages[0].blocks,
        ctx: {
          tenant: f.tenant,
          pagePath: '/',
          pageType: 'page',
          isPreview: true,
        },
      }),
    );
    for (const type of [
      'hero.landing',
      'proof.strip',
      'narrative.statement',
      'feature.showcase',
      'proof.testimonials',
    ])
      assert.ok(html.includes(`data-block="${type}"`), type);
    assert.match(html, /type="email"/);
    assert.match(html, /Envios desativados/);
    assert.match(html, /name="attribution"/);
    assert.match(html, /site-sticky-cta/);
  });

await test('landing não relaxa o contrato multipágina nem aceita estrutura multipágina por referência', () => {
  const f = landingFixture();
  assert.equal(designSchemaFor('comercial').safeParse(f.input).success, false);
  assert.ok(
    lintSite(f.pages, f.images, 'publish', {
      ...f.tenant.brand,
      vibe: 'comercial',
    }).some((v) => v.rule === 'inbound-paginas'),
  );
  assert.equal(
    designSchemaFor('landing').safeParse({
      ...f.input,
      structure: 'comercial-vitrine',
    }).success,
    false,
  );
  assert.equal(
    designSchemaFor('landing').safeParse({
      ...f.input,
      brief: {
        ...f.input.brief,
        pagePlan: [
          ...f.input.brief.pagePlan,
          { ...f.input.brief.pagePlan[0], slug: 'extra' },
        ],
      },
    }).success,
    false,
  );
  assert.ok(
    laneIssues(
      'comercial',
      { ...f.input, referenceDirection: {} },
      new Set(['layout']),
    ).length,
  );
  assert.ok(
    laneIssues(
      'landing',
      { ...f.input, heroComposition: 'cover' },
      new Set(['layout']),
    ).length,
  );
});

const cases = [
  [
    'landing-pagina-extra',
    (f) =>
      f.pages.push({
        ...structuredClone(f.pages[0]),
        id: 'extra',
        slug: 'sobre',
      }),
  ],
  [
    'landing-pagina-extra',
    (f) =>
      f.pages.push({
        ...structuredClone(f.pages[0]),
        id: 'paid',
        type: 'paid_lp',
        slug: 'campanha',
      }),
  ],
  [
    'landing-acao-unica',
    (f) => (find(f, 'nav.bar').props.cta.href = 'https://different.test/'),
  ],
  [
    'landing-acao-unica',
    (f) => (find(f, 'feature.showcase').props.items[0].cta.href = '#mesa'),
  ],
  [
    'landing-acao-unica',
    (f) =>
      (find(f, 'pricing.table').props.plans[0].cta.href = 'https://buy.test/'),
  ],
  [
    'landing-acao-repetida',
    (f) => {
      find(f, 'feature.showcase').props.items.forEach((i) => delete i.cta);
      f.pages[0].blocks = f.pages[0].blocks.filter(
        (b) => b.type !== 'pricing.table',
      );
    },
  ],
  ['landing-prova', (f) => (f.tenant.brief.evidence = [])],
  [
    'landing-prova',
    (f) => (find(f, 'proof.strip').props.items[0].value = '999'),
  ],
  ['landing-prova', (f) => (find(f, 'proof.strip').props.items[0].value = '2')],
  [
    'landing-prova',
    (f) =>
      (find(f, 'proof.testimonials').props.items[0].author = 'Outra pessoa'),
  ],
  [
    'landing-prova',
    (f) =>
      (f.pages[0].blocks = f.pages[0].blocks.filter(
        (b) => !b.type.startsWith('proof.'),
      )),
  ],
  [
    'landing-formulario-curto',
    (f) => {
      const p = find(f, 'form.lead').props;
      p.fields = Array.from({ length: 7 }, (_, i) => ({
        name: `campo${i}`,
        type: 'text',
        label: 'Dado',
      }));
    },
  ],
  ['landing-secoes', (f) => f.pages[0].blocks.splice(2, 7)],
  [
    'landing-secoes',
    (f) => {
      for (let i = 0; i < 3; i++)
        f.pages[0].blocks.splice(2, 0, {
          ...structuredClone(find(f, 'narrative.statement')),
          id: `more${i}`,
        });
    },
  ],
  [
    'landing-menu-ancoras',
    (f) => (find(f, 'nav.bar').props.links[0].href = '/sobre'),
  ],
  [
    'anchor-inexistente',
    (f) => (find(f, 'nav.bar').props.links[0].href = '#ausente'),
  ],
  ['landing-obrigado', (f) => f.pages.pop()],
  [
    'landing-obrigado',
    (f) => (find(f, 'form.lead').props.redirectTo = 'https://other.test/'),
  ],
  [
    'landing-preco',
    (f) => (find(f, 'pricing.table').props.plans[0].price = 'R$ 1'),
  ],
  ['inbound-jornada', (f) => (f.pages[0].meta.inbound.stage = 'discovery')],
  [
    'inbound-conteudo',
    (f) => {
      f.pages[0].blocks = f.pages[0].blocks.filter((b) =>
        ['hero.landing', 'nav.bar', 'footer.compact'].includes(b.type),
      );
    },
  ],
];
for (const [rule, mutate] of cases)
  await test(`landing recusa ou aponta ${String(rule)}: ${cases.indexOf(cases.find((v) => v[1] === mutate))}`, () => {
    const f = landingFixture();
    mutate(f);
    assert.ok(
      rules(f).some((v) => v.rule === rule),
      JSON.stringify(rules(f)),
    );
  });
await test('formulário com cinco campos avisa, acima de seis bloqueia; secundário e âncoras equivalentes permitidos', () => {
  const f = landingFixture();
  const form = find(f, 'form.lead');
  form.props.fields = Array.from({ length: 5 }, (_, i) => ({
    name: `campo${i}`,
    label: 'Campo',
    type: 'text',
  }));
  find(f, 'hero.landing').props.secondary = {
    label: 'Ver a mesa',
    href: '#mesa',
  };
  find(f, 'nav.bar').props.cta.href = '/#contato';
  assert.equal(
    rules(f).find((v) => v.rule === 'landing-formulario-curto').level,
    'warn',
  );
  assert.ok(!rules(f).some((v) => v.rule === 'landing-acao-unica'));
});
await test('hero form exige campos válidos e âncora interna única; perfil reconhecido e sem migração dos legados', () => {
  const f = landingFixture('form');
  const hero = find(f, 'hero.landing');
  const invalid = structuredClone(hero.props);
  invalid.form.fields.push(...invalid.form.fields, ...invalid.form.fields);
  assert.equal(blockSchemas['hero.landing'].safeParse(invalid).success, false);
  find(f, 'narrative.statement').props.anchor = 'pedido';
  assert.ok(
    lintPage(f.pages[0], f.tenant.brand.design).some(
      (v) => v.rule === 'anchor-duplicada',
    ),
  );
});
await test('prova usa upload real; hero form renderiza a foto e exige descrição; headline respeita 60 caracteres', async () => {
  const f = landingFixture('form');
  const hero = find(f, 'hero.landing');
  hero.props.image = f.images[0].url;
  assert.equal(
    blockSchemas['hero.landing'].safeParse(hero.props).success,
    false,
  );
  hero.props.imageAlt = 'Ilustração de mesa para teste local';
  assert.equal(
    blockSchemas['hero.landing'].safeParse(hero.props).success,
    true,
  );
  const html = renderToStaticMarkup(
    createElement(RenderBlocks, {
      blocks: f.pages[0].blocks,
      ctx: { tenant: f.tenant, pagePath: '/', pageType: 'page' },
    }),
  );
  assert.match(html, /site-landing-form-image/);
  const item = find(f, 'proof.testimonials').props.items[0];
  item.image = f.images[0].url;
  item.imageAlt = 'Foto autorizada do depoimento';
  assert.ok(!rules(f).some((v) => v.rule === 'landing-prova'));
  f.images[0].model = 'image-generator';
  assert.ok(rules(f).some((v) => v.rule === 'landing-prova'));
  const { blockFields, fieldTextError } = await j.import(
    '../lib/blocks/fields.ts',
  );
  const field = blockFields(hero).find((v) => v.path === 'headline');
  assert.equal(fieldTextError(field, 'A'.repeat(60)), undefined);
  assert.match(fieldTextError(field, 'A'.repeat(61)), /60/);
});
await test('prompts de preparação e composição descrevem página única sem reabrir revisão', () => {
  const f = landingFixture();
  for (const phase of ['briefing', 'composicao']) {
    const prompt = systemPrompt(f.tenant, '', '', '', { phase });
    assert.match(prompt, /uma única|Uma única|exatamente uma/);
    assert.doesNotMatch(
      prompt,
      /Todo projeto tem no mínimo 3|compare as três estruturas|compare as doze estruturas/,
    );
    assert.match(prompt, /revisão é humana|Não gere fotos/);
  }
});
await test('publicação real valida prova, sem escrita ao falhar; snapshot promovido em lote', async () => {
  const f = landingFixture();
  const writes = [];
  const sql = Object.assign(
    (parts, ...values) => ({ sql: parts.join('?'), values }),
    { transaction: async (batch) => writes.push(...batch) },
  );
  const { publishSite } = await loadModule('lib/sites/publish.ts', {
    '@/lib/db': { db: () => sql },
    '@/lib/tenant-queries': { listPages: async () => f.pages },
    '@/lib/images/queries': { listImages: async () => f.images },
    '@/lib/design/uniqueness': {
      compositionConflict: async () => null,
      compositionConflictMessage: () => '',
    },
  });
  const original = f.tenant.brief.evidence;
  f.tenant.brief.evidence = [];
  assert.equal((await publishSite(f.tenant)).published.length, 0);
  assert.equal(writes.length, 0);
  f.tenant.brief.evidence = original;
  const result = await publishSite(f.tenant);
  assert.equal(result.blocked.length, 0, JSON.stringify(result));
  assert.equal(writes.length, 3);
  assert.equal(f.pages[0].publishedBlocks, null);
});

await test('ferramentas reais: direção e composição em memória, tenant e páginas publicados preservados', async () => {
  const { memoryHarness } = await import('../scripts/lib/harness-memory.mjs');
  const f = landingFixture();
  const state = await memoryHarness(f.tenant, f.images);
  const first = state.buildTools({ phase: 'briefing' });
  const result = await first.set_design.execute(landingInput());
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(state.tenant.brand.vibe, 'landing');
  assert.equal(state.tenant.brand.design.version, 7);
  const tools = state.buildTools({ phase: 'composicao' });
  const input = {
    pages: f.pages.map((p) => ({
      slug: p.slug,
      type: p.type,
      title: p.title,
      seoTitle: p.seo.title,
      seoDescription: p.seo.description,
      inbound: p.meta.inbound,
      blocks: p.blocks.map(({ type, props }) => ({ type, props })),
    })),
  };
  const built = await tools.build_site.execute(input);
  assert.equal(built.ok, true, JSON.stringify(built));
  assert.ok(
    !built.publicationPending.some((v) => v.level === 'error'),
    JSON.stringify(built),
  );
  assert.equal(state.pages.length, 2);
  assert.ok(
    state.pages.every(
      (p) => p.tenantId === f.tenant.id && p.publishedBlocks === null,
    ),
  );
  const before = JSON.stringify(state.pages);
  await assert.rejects(
    tools.create_page.execute({
      slug: 'sobre',
      type: 'page',
      title: 'Sobre a loja',
    }),
    /Landing Page/,
  );
  const extra = await tools.build_site.execute({
    pages: [...input.pages, { ...input.pages[0], slug: 'sobre' }],
  });
  assert.match(extra.error, /Landing Page/);
  assert.equal(JSON.stringify(state.pages), before);
});

await test('depende da evidência atual também na publicação pontual e não usa rascunho de obrigado', async () => {
  const f = landingFixture();
  const { publicationState } = await j.import('../lib/taste/site.ts');
  const prospective = publicationState(f.pages, new Set([f.pages[0].id]));
  assert.ok(
    lintSite(
      prospective,
      f.images,
      'publish',
      f.tenant.brand,
      f.tenant.brief,
    ).some((v) => v.rule === 'landing-obrigado'),
  );
});
