import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createJiti } from 'jiti';
import { Output } from 'ai';
import { loadModule } from './helpers/load-module.mjs';

const j = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const profile = await j.import('../lib/design/profile.ts');
const metrics = await j.import('../lib/taste/metrics.ts');
const { lintPage } = await j.import('../lib/taste/lint.ts');
const { lintSite } = await j.import('../lib/taste/site.ts');
const { scenePlan } = await j.import('../lib/images/scene-plan.ts');
const { plannedScenes, generationState } = await j.import(
  '../lib/sites/generation.ts',
);
const { systemPrompt } = await j.import('../lib/taste/prompt.ts');
const { grammarDirection, VIBE_GRAMMAR } = await j.import(
  '../lib/design/vibes.ts',
);
const { blockSchemas } = await j.import('../lib/blocks/registry.ts');
const plain = (value) => JSON.parse(JSON.stringify(value));
const photo = (n) => `https://assets.test/cena-${n}.webp`;
const body =
  'A escolha do ambiente depende da rotina e das preferências de quem usa o espaço. Compartilhe medidas, referências e o que já foi definido no projeto. A equipe pode então orientar a conversa sobre as possibilidades, os detalhes e o acabamento. Antes de confirmar uma proposta, confira a adequação do material real ao uso previsto. Fotos e amostras ajudam a visualizar o resultado, mas não substituem a avaliação das características do produto. Reúna as informações disponíveis, explique suas dúvidas e compare as alternativas. O próximo passo é uma conversa com escopo claro, incluindo as condições e as decisões que ainda precisam ser tomadas em conjunto.';
const block = (id, type, props) => ({
  id,
  type,
  props: blockSchemas[type].parse(props),
});

function fixture(version = 4) {
  const design = {
    version,
    concept: 'Recortes da matéria no ambiente',
    signatureElement: 'Fotografia de matéria em cada capítulo',
    displayFont: 'humanist',
    bodyFont: 'source',
    heroComposition: 'split',
    navigation: 'bar',
    rhythm: 'alternating',
    imageTreatment: 'framed',
    surfaceStyle: 'flat',
    motif: 'none',
    signature: 'fixture',
    definedAt: '2026-09-12T00:00:00Z',
  };
  const tenant = {
    id: 'tenant-1',
    slug: 'fixture',
    name: 'Matéria',
    brand: { vibe: 'comercial', design },
    brief: {},
    dials: { variance: 4, motion: 3, density: 5 },
    contacts: { phones: [], addresses: [], social: [] },
    whatsapp: null,
    contactEmail: null,
    locale: 'pt-BR',
  };
  const images = [1, 2, 3].map((seq) => ({
    id: `img-${seq}`,
    seq,
    url: photo(seq),
    kind: 'foto',
    model: 'openai/gpt-image-2',
    blobPath: `tenants/fixture/gerado/${seq}.webp`,
    status: 'disponivel',
    targetBlock: null,
    ratio: '4:3',
  }));
  const pages = ['', 'materiais', 'guia'].map((slug, index) => ({
    id: `page-${index}`,
    tenantId: tenant.id,
    slug,
    type: 'page',
    title: `Assunto ${index}`,
    navOrder: index,
    seo: {
      title: `Conheça o assunto ${index}`,
      description: `Informações para escolher o assunto ${index}.`,
    },
    meta: {
      inbound: {
        stage: ['conversion', 'consideration', 'discovery'][index],
        intent: `Entender o assunto específico ${index}`,
      },
    },
    blocks: [
      block('nav', 'nav.bar', {
        logoText: tenant.name,
        links: [
          { label: 'Início', href: '/' },
          { label: 'Materiais', href: '/materiais' },
          { label: 'Guia', href: '/guia' },
        ],
      }),
      block('hero', 'hero.split', {
        layout: 'split',
        headline: 'Um ambiente para cada rotina',
        image: photo(1),
        imageAlt: 'Cena ilustrativa de ambiente',
        cta: { label: 'Ver materiais', href: '/materiais' },
        presentation: { tone: 'paper' },
      }),
      block('text', 'editorial.text', {
        layout: 'narrow',
        body: `${body} Contexto específico ${index}.`,
        presentation: { tone: 'accent' },
      }),
      ...(index === 0
        ? [
            block('explorer', 'feature.explorer', {
              layout: 'showroom',
              title: 'Escolha pelo ambiente',
              presentation: { tone: 'soft' },
              items: [1, 2].map((n) => ({
                title: `Ambiente ${n}`,
                headline: 'Textura e luz no espaço',
                body: 'Uma composição coerente com a aplicação e o uso previsto.',
                image: photo(n),
                imageAlt: 'Ambiente ilustrativo gerado',
                cta: { label: 'Ver materiais', href: '/materiais' },
              })),
            }),
            block('facts', 'editorial.facts', {
              layout: 'split',
              title: 'O que levar para a conversa',
              facts: [
                { label: 'Espaço', value: 'Medidas disponíveis' },
                { label: 'Projeto', value: 'Dúvidas e referências' },
              ],
            }),
          ]
        : []),
      block('cta', 'cta.band', {
        layout: 'band',
        title: 'Converse sobre seu projeto',
        cta: { label: 'Ver materiais', href: '/materiais' },
      }),
    ],
  }));
  return { tenant, pages, images };
}

async function uniqueness(rows = []) {
  return loadModule('lib/design/uniqueness.ts', {
    '../db': { db: () => async () => rows },
    '../taste/metrics': metrics,
    './profile': profile,
  });
}

// Dados e transação simulados; lintPage, lintSite e a política de unicidade são reais.
async function publisher(f, rows = []) {
  const writes = [];
  const sql = Object.assign(
    (parts, ...values) => ({ sql: parts.join('?'), values }),
    {
      transaction: async (statements) => writes.push(...statements),
    },
  );
  const unique = await uniqueness(rows);
  const { publishSite } = await loadModule('lib/sites/publish.ts', {
    '@/lib/db': { db: () => sql },
    '@/lib/tenant-queries': { listPages: async () => f.pages },
    '@/lib/images/queries': { listImages: async () => f.images },
    '@/lib/design/uniqueness': unique,
  });
  return { publish: (slug) => publishSite(f.tenant, slug), writes, unique };
}

for (const version of [2, 3, 4]) {
  await test(`publicação v${version} usa a política de unicidade da sua versão`, async () => {
    const f = fixture(version);
    const other = structuredClone(f.pages[0].blocks);
    other.find((b) => b.id === 'hero').props.layout = 'cover';
    const gate = await publisher(f, [
      { blocks: other, design: f.tenant.brand.design },
    ]);
    const result = await gate.publish();
    assert.equal(result.blocked.length, version === 4 ? 1 : 0);
    assert.equal(gate.writes.length, version === 4 ? 0 : 4);
    if (version === 4) assert.match(result.blocked[0].preflight, /80%/);

    const exact = await publisher(f, [
      { blocks: f.pages[0].blocks, design: f.tenant.brand.design },
    ]);
    assert.match(
      (await exact.publish()).blocked[0].preflight,
      /composicao-duplicada/,
    );
    assert.equal(exact.writes.length, 0);
    // A política legada também distingue tom e ordem, sem permitir cópia exata.
    other.find((b) => b.id === 'hero').props.layout = 'split';
    other.find((b) => b.id === 'text').props.presentation.tone = 'ink';
    const changedTone = await uniqueness([{ blocks: other }]);
    assert.equal(
      Boolean(
        await changedTone.compositionConflict(
          f.tenant.id,
          f.pages[0].blocks,
          f.tenant.brand.design,
        ),
      ),
      version === 4,
    );
  });

  await test(`set_blocks v${version} compartilha a mesma trava e preserva o rascunho ao recusar`, async () => {
    const f = fixture(version);
    const other = structuredClone(f.pages[0].blocks);
    other.find((b) => b.id === 'hero').props.layout = 'cover';
    let writes = 0;
    const { buildTools } = await loadModule('lib/ai/tools.ts', {
      '@/lib/db': {
        db: () => async () => {
          writes++;
          return [];
        },
      },
      '@/lib/tenant-queries': { getPage: async () => f.pages[0] },
      '@/lib/design/uniqueness': await uniqueness([{ blocks: other }]),
    });
    const result = await buildTools(f.tenant).set_blocks.execute({
      page: '',
      blocks: f.pages[0].blocks,
    });
    assert.equal(Boolean(result.error), version === 4);
    if (version === 4) assert.match(result.error, /80%/);
    assert.equal(writes, version === 4 ? 0 : 1);
  });
}

await test('publicação pontual preserva marca publicada e publicação completa valida a nova', async () => {
  const f = fixture();
  f.tenant.publishedSnapshot = { brand: structuredClone(f.tenant.brand) };
  f.pages.forEach((p) => {
    p.publishedBlocks = structuredClone(p.blocks);
    p.publishedSeo = structuredClone(p.seo);
  });
  f.tenant.brand = {
    vibe: 'artistico',
    design: { ...f.tenant.brand.design, heroComposition: 'offset' },
  };
  const single = await publisher(f);
  assert.deepEqual(plain((await single.publish('guia')).published), ['/guia']);
  assert.equal(single.writes.length, 2);
  assert.equal(single.writes.at(-1).sql.includes('published_snapshot'), false);
  const complete = await publisher(f);
  assert.match(
    (await complete.publish()).blocked[0].preflight,
    /abertura-fora-da-vibe/,
  );
  assert.equal(complete.writes.length, 0);

  // Também valida unicidade com o hero do snapshot quando o bloco omite layout.
  const other = structuredClone(f.pages[0].blocks);
  const home = f.pages[0];
  delete home.blocks.find((b) => b.id === 'hero').props.layout;
  home.publishedBlocks = structuredClone(home.blocks);
  other.find((b) => b.id === 'hero').props.layout = 'split';
  other.find((b) => b.id === 'facts').props.layout = 'ledger';
  const duplicate = await publisher(f, [{ blocks: other }]);
  assert.match((await duplicate.publish('guia')).blocked[0].preflight, /80%/);
  assert.equal(duplicate.writes.length, 0);
});

await test('primeira publicação pontual usa e grava a marca do rascunho', async () => {
  const f = fixture();
  // Páginas já no ar sem snapshot: compatibilidade de importações antigas.
  f.pages.forEach((p) => {
    p.publishedBlocks = structuredClone(p.blocks);
    p.publishedSeo = structuredClone(p.seo);
  });
  const gate = await publisher(f);
  assert.deepEqual(plain((await gate.publish('guia')).published), ['/guia']);
  assert.match(gate.writes.at(-1).sql, /published_snapshot/);
  assert.deepEqual(
    JSON.parse(gate.writes.at(-1).values[0]).brand,
    f.tenant.brand,
  );
});

await test('v4 mantém o piso de layouts e apresentações, inclusive na publicação', async () => {
  const f = fixture();
  const inner = f.pages[1];
  inner.blocks.forEach((b) => {
    delete b.props.layout;
    delete b.props.presentation;
  });
  for (const version of [2, 3, 4]) {
    const errors = lintPage(inner, {
      ...f.tenant.brand.design,
      version,
    }).filter((f) => f.level === 'error');
    assert.ok(
      errors.some((f) => f.rule === 'composicao-generica'),
      `v${version}`,
    );
    assert.ok(
      errors.some((f) => f.rule === 'ritmo-generico'),
      `v${version}`,
    );
  }
  const gate = await publisher(f);
  assert.match(
    (await gate.publish()).blocked[0].preflight,
    /composicao-generica/,
  );
  assert.equal(gate.writes.length, 0);
});

for (const version of [2, 3]) {
  await test(`retomada v${version} preserva pedidos, proporções e cobertura nas quatro vibes`, () => {
    for (const vibe of ['comercial', 'moderno', 'ousado', 'artistico']) {
      const f = fixture(version);
      f.tenant.brand.vibe = vibe;
      // Perfil legado com hero fora da faixa nova, permitido por referência.
      f.tenant.brand.design.heroComposition = 'editorial';
      const slots = [
        ['hero', 'hero.editorial', '16:9'],
        ['protagonista', 'feature.explorer', '4:3'],
        ['protagonista', 'feature.explorer', '4:3'],
        ['subpagina', 'narrative.split', '5:6'],
        ['subpagina', 'media.image', '16:9'],
      ];
      f.tenant.brief.imageScenes = slots.map(([role, targetBlock], i) => ({
        role,
        targetBlock,
        page: i < 3 ? '' : 'guia',
        request: `Uma cena concreta para orientar a escolha do material ${i}.`,
      }));
      const plan = plannedScenes(f.tenant);
      assert.deepEqual(
        plan.map(({ role, targetBlock, ratio }) => [role, targetBlock, ratio]),
        slots,
      );
      assert.deepEqual(
        plan.map(({ request, page }) => ({ request, page })),
        f.tenant.brief.imageScenes.map(({ request, page }) => ({
          request,
          page,
        })),
      );
      const library = slots.map(([_, targetBlock, ratio], i) => ({
        ...f.images[0],
        id: `img-${i}`,
        url: photo(i),
        targetBlock,
        ratio,
      }));
      const state = generationState(f.tenant, [], library);
      assert.equal(state.next, 'composicao');
      assert.equal(state.coveredScenes, 5);
      const prompt = systemPrompt(f.tenant, '', '/', '', {
        phase: 'composicao',
      });
      assert.doesNotMatch(prompt, /Gramática obrigatória/);
    }
    const atelier = scenePlan(
      { version, heroComposition: 'atelier' },
      3,
      'ousado',
    );
    assert.equal(atelier.length, 6);
    assert.equal(atelier[1].role, 'hero-detail');
  });
}

await test('a gramática exige duas fotos distintas e geradas no protagonista permitido', async () => {
  const f = fixture();
  f.tenant.brand.vibe = 'moderno';
  f.tenant.brand.design.heroComposition = 'editorial';
  f.pages[0].blocks.find((b) => b.id === 'hero').props.layout = 'editorial';
  const bento = block('bento', 'feature.bento', {
    layout: 'showcase',
    title: 'Escolhas para o ambiente',
    items: [1, 2].map((n) => ({
      title: `Material ${n}`,
      body: 'Informações para orientar a escolha.',
    })),
  });
  f.pages[0].blocks.splice(-1, 0, bento);
  for (const photos of [[], [photo(1)], [photo(1), photo(1)]]) {
    bento.props.items.forEach((item, i) => {
      item.image = photos[i];
    });
    const gate = await publisher(f);
    assert.match(
      (await gate.publish()).blocked[0].preflight,
      /protagonista-fora-da-vibe/,
    );
    assert.equal(gate.writes.length, 0);
  }
  bento.props.items.forEach((item, i) => {
    item.image = photo(i + 1);
  });
  f.images[1].blobPath = 'tenants/fixture/uploads/2.webp';
  assert.ok(
    lintSite(f.pages, f.images, 'publish', f.tenant.brand).some(
      (f) => f.rule === 'protagonista-fora-da-vibe',
    ),
  );
  f.images[1].blobPath = 'tenants/fixture/gerado/2.webp';
  assert.equal(
    lintSite(f.pages, f.images, 'publish', f.tenant.brand).some(
      (f) => f.rule === 'protagonista-fora-da-vibe',
    ),
    false,
  );
  f.images[1].blobPath = 'tenants/fixture/uploads/2.webp';
  f.images[1].model = 'upload';
  assert.equal(
    lintSite(f.pages, f.images, 'publish', f.tenant.brand).some(
      (finding) => finding.rule === 'protagonista-fora-da-vibe',
    ),
    false,
  );
  const repaired = await publisher(f);
  assert.deepEqual(plain((await repaired.publish()).published), [
    '/',
    '/materiais',
    '/guia',
  ]);
});

await test('crítico preserva a composição v2/v3 e recebe gramática apenas em v4', async () => {
  const inputs = [];
  const { critiquePages } = await loadModule('lib/review/critic.ts', {
    ai: {
      Output,
      generateText: async (input) => {
        inputs.push(input);
        return {
          output: { strengths: [], findings: [] },
          usage: {},
          steps: [],
        };
      },
    },
  });
  for (const version of [2, 3, 4]) {
    const f = fixture(version);
    await critiquePages(f.tenant, f.pages, [
      {
        page: '/',
        viewport: 'desktop',
        width: 1440,
        jpeg: Buffer.from('synthetic pixels'),
      },
    ]);
    const input = inputs.at(-1);
    assert.equal(
      input.instructions.includes('Gramática obrigatória'),
      version === 4,
    );
    assert.equal(
      Boolean(JSON.parse(input.messages[0].content[0].text).gramaticaDaVibe),
      version === 4,
    );
  }
});

// Medido em 12/09/2026 no cliente grupofisk: 48 caracteres a 8vw em 11ch viravam
// uma palavra por linha e seis linhas de hero. A vibe agora tem orçamento de
// headline, e o renderer marca o comprimento para o CSS reduzir a escala.
await test('headline acima do orçamento da vibe vira aviso só no perfil v4', () => {
  const long = 'Franquia de escolas para empresários em Curitiba';
  assert.equal(long.length, 48);
  const warnings = (version, vibe, headline) => {
    const f = fixture(version);
    f.tenant.brand.vibe = vibe;
    f.pages[0].blocks.find((b) => b.id === 'hero').props.headline = headline;
    return lintSite(f.pages, f.images, 'publish', f.tenant.brand).filter(
      (finding) => finding.rule === 'headline-fora-da-vibe',
    );
  };
  const [warning] = warnings(4, 'artistico', long);
  assert.equal(warning.level, 'warn');
  assert.equal(warning.page, '/');
  assert.equal(warning.blockId, 'hero');
  assert.match(warning.message, /48 caracteres/);
  assert.match(warning.message, /até 40/);
  assert.equal(warnings(4, 'artistico', long.slice(0, 40)).length, 0);
  assert.equal(warnings(4, 'comercial', long).length, 0);
  assert.equal(warnings(4, 'ousado', long.slice(0, 37)).length, 1);
  assert.equal(warnings(4, 'ousado', long.slice(0, 36)).length, 0);
  for (const version of [2, 3])
    assert.equal(warnings(version, 'artistico', long).length, 0);
  assert.equal(VIBE_GRAMMAR.artistico.headline, 40);
  assert.match(grammarDirection('artistico'), /até 40 caracteres/);
  assert.match(grammarDirection('ousado'), /até 36 caracteres/);
});

await test('o renderer marca o comprimento do headline para a escala da display', async () => {
  const jsx = createJiti(import.meta.url, {
    alias: { '@': process.cwd() },
    jsx: { runtime: 'automatic' },
    fsCache: false,
  });
  const { HeroSplit, HeroStatement, headlineScale } = await jsx.import(
    '../lib/blocks/components.tsx',
  );
  assert.equal(headlineScale('A natureza desenha.'), 'short');
  assert.equal(headlineScale('Franquia de escolas em Curitiba'), 'medium');
  assert.equal(
    headlineScale('Franquia de escolas para empresários em Curitiba'),
    'long',
  );
  const ctx = {
    tenant: fixture().tenant,
    pagePath: '/',
  };
  const cta = { label: 'Falar pelo WhatsApp', href: '/contato' };
  const split = renderToString(
    createElement(HeroSplit, {
      headline: 'Franquia de escolas para empresários em Curitiba',
      layout: 'atelier',
      image: photo(1),
      secondaryImage: photo(2),
      cta,
      ctx,
    }),
  );
  assert.match(
    split,
    /<h1[^>]*class="site-headline[^"]*"[^>]*data-length="long"/,
  );
  const statement = renderToString(
    createElement(HeroStatement, {
      headline: 'Fale com a equipe',
      layout: 'center',
      cta,
      ctx,
    }),
  );
  assert.match(statement, /<h1[^>]*data-length="short"/);
});

await test('a vibe moderno recusa a grade e a direção fala em fio, mono e pílula', async () => {
  const { VIBE_LANE, VIBE_DIRECTION, VIBE_HINT, laneIssues } = await j.import(
    '../lib/design/vibes.ts',
  );
  assert.deepEqual(VIBE_LANE.moderno.axes.motif, ['none']);
  const input = {
    displayFont: 'grotesk',
    bodyFont: 'sans',
    heroComposition: 'editorial',
    navigation: 'minimal',
    rhythm: 'chapters',
    imageTreatment: 'framed',
    surfaceStyle: 'outlined',
    motif: 'grid',
    radius: 'md',
    ink: '#f5f6f8',
    paper: '#0b0c0e',
    surface: '#131519',
    variance: 3,
    motion: 4,
    density: 4,
  };
  const issues = laneIssues('moderno', input);
  assert.equal(issues.length, 1);
  assert.match(issues[0], /motif: "grid".*Use none/);
  assert.deepEqual(laneIssues('moderno', { ...input, motif: 'none' }), []);
  assert.doesNotMatch(VIBE_DIRECTION.moderno, /grade e a linha fina/);
  assert.doesNotMatch(VIBE_HINT.moderno, /grade/);
  assert.match(VIBE_DIRECTION.moderno, /fios de 1px/);
  assert.match(VIBE_DIRECTION.moderno, /mono/);
  assert.match(VIBE_DIRECTION.moderno, /pílula clara/);
  assert.match(VIBE_DIRECTION.moderno, /position "fixed"/);
  assert.match(grammarDirection('moderno'), /Abertura da home/);
});

await test('o pre-flight avisa logo de placa clara sobre papel escuro e some com a versão escura', () => {
  const f = fixture();
  const logoUrl = 'https://blob.test/tenants/fixture/logo/1-logo.png';
  f.tenant.brand = {
    ...f.tenant.brand,
    paper: '#0b0e14',
    ink: '#f5f5f4',
    logoUrl,
    logoFit: {
      source: logoUrl,
      measuredAt: '2026-09-12T00:00:00Z',
      width: 185,
      height: 148,
      hasAlpha: false,
      transparentFraction: 0,
      opaqueLuminance: 0.611,
      lightFraction: 0.511,
      darkFraction: 0.3,
      plate: 'light',
    },
  };
  const logoWarnings = () =>
    lintSite(f.pages, f.images, 'publish', f.tenant.brand).filter(
      (finding) => finding.rule === 'logo-fundo-escuro',
    );
  const [warning] = logoWarnings();
  assert.ok(warning);
  assert.equal(warning.level, 'warn');
  assert.equal(warning.page, '/');
  assert.match(warning.message, /placa clara/);
  f.tenant.brand.logoDarkUrl =
    'https://blob.test/tenants/fixture/logo/b/branca.png';
  assert.equal(logoWarnings().length, 0);
  // A medição de um logo anterior não acusa o logo atual.
  f.tenant.brand.logoDarkUrl = undefined;
  f.tenant.brand.logoUrl = 'https://blob.test/tenants/fixture/logo/2-outro.png';
  assert.equal(logoWarnings().length, 0);
});

await test('nav e rodapé mostram a versão escura do logo sobre papel escuro', async () => {
  const jsx = createJiti(import.meta.url, {
    alias: { '@': process.cwd() },
    jsx: { runtime: 'automatic' },
    fsCache: false,
  });
  const { NavBar, FooterCompact } = await jsx.import(
    '../lib/blocks/components.tsx',
  );
  const tenant = fixture().tenant;
  const logoUrl = 'https://blob.test/logo.png';
  const logoDarkUrl = 'https://blob.test/branca.png';
  const render = (brand, presentation) => ({
    nav: renderToString(
      createElement(NavBar, {
        logoText: 'Matéria',
        links: [],
        presentation,
        ctx: { tenant: { ...tenant, brand }, pagePath: '/' },
      }),
    ),
    footer: renderToString(
      createElement(FooterCompact, {
        logoText: 'Matéria',
        links: [],
        presentation,
        ctx: { tenant: { ...tenant, brand }, pagePath: '/' },
      }),
    ),
  });
  const dark = {
    ...tenant.brand,
    paper: '#0b0e14',
    ink: '#f5f5f4',
    logoUrl,
    logoDarkUrl,
  };
  const onDark = render(dark);
  assert.match(onDark.nav, /src="https:\/\/blob\.test\/branca\.png"/);
  assert.match(onDark.footer, /src="https:\/\/blob\.test\/branca\.png"/);
  const light = { ...dark, paper: '#ffffff', ink: '#14161a' };
  const onLight = render(light);
  assert.match(onLight.nav, /src="https:\/\/blob\.test\/logo\.png"/);
  assert.match(onLight.footer, /src="https:\/\/blob\.test\/logo\.png"/);
  // Uma seção escura num site claro pede a versão escura; sem ela, a original.
  assert.match(render(light, { tone: 'ink' }).nav, /branca\.png/);
  assert.match(
    render({ ...light, logoDarkUrl: undefined }, { tone: 'ink' }).nav,
    /logo\.png/,
  );
});
