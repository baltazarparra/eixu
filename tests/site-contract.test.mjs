import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers/load-module.mjs';
import { createJiti } from 'jiti';
// O alias resolve os módulos que importam por '@', como lib/sites/.
const j = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const { lintSite, pageImageUrls, publicationState } = await j.import(
  '../lib/taste/site.ts',
);
const { blockSchemas, catalogForPrompt } = await j.import(
  '../lib/blocks/registry.ts',
);

const scene = (n) => `https://assets.test/scene-${n}.webp`;
const images = [1, 2].map((seq) => ({
  id: `img-${seq}`,
  seq,
  url: scene(seq),
  kind: 'foto',
  model: 'openai/gpt-image-2',
  blobPath: `tenants/sample/gerado/batch/${seq}.webp`,
  status: 'aprovada',
  targetBlock: null,
  requestText: `Cena ${seq}`,
  alt: null,
  score: null,
  critique: {},
  createdAt: `2026-09-0${seq}T10:00:00.000Z`,
}));
const body =
  'A escolha do ambiente depende da rotina e das preferências de quem usa o espaço. Compartilhe medidas, referências e o que já foi definido no projeto. A equipe pode então orientar a conversa sobre as possibilidades, os detalhes e o acabamento. Antes de confirmar uma proposta, confira a adequação do material real ao uso previsto. Fotos e amostras ajudam a visualizar o resultado, mas não substituem a avaliação das características do produto. Reúna as informações disponíveis, explique suas dúvidas e compare as alternativas. O próximo passo é uma conversa com escopo claro, incluindo as condições e as decisões que ainda precisam ser tomadas em conjunto.';
function project() {
  return ['', 'materiais', 'guia'].map((slug, i) => ({
    slug,
    type: 'page',
    title: `Página ${i}`,
    seo: {
      title: `Título específico ${i}`,
      description: `Descrição específica da página ${i}.`,
    },
    meta: {
      inbound: {
        stage: ['conversion', 'consideration', 'discovery'][i],
        intent: `Responder a uma necessidade distinta da etapa ${i}.`,
      },
    },
    blocks: [
      {
        id: 'nav',
        type: 'nav.bar',
        props: {
          logoText: 'Estúdio',
          links: [
            { label: 'Início', href: '/' },
            { label: 'Materiais', href: '/materiais' },
            { label: 'Guia', href: '/guia' },
          ],
        },
      },
      {
        id: 'hero',
        type: 'hero.split',
        props: {
          headline: 'Um ambiente para cada rotina',
          layout: 'atelier',
          image: scene(1),
          imageAlt: 'Cena de ambiente',
          secondaryImage: scene(2),
          secondaryImageAlt: 'Amostra do material',
          cta: { label: 'Materiais', href: '/materiais' },
        },
      },
      {
        id: 'text',
        type: 'editorial.text',
        props: {
          body: `${body} Contexto específico ${i}.`,
          presentation: { tone: 'accent' },
        },
      },
    ],
  }));
}
/**
 * O contrato exige uma seção protagonista com fotos na home. project() é o
 * piso estrutural antigo, que hoje reprova; rich() é o projeto conforme.
 */
function rich() {
  const pages = project();
  pages[0].blocks.push({
    id: 'explorer',
    type: 'feature.explorer',
    props: {
      title: 'Escolha pelo ambiente',
      items: [1, 2].map((n) => ({
        title: `Ambiente ${n}`,
        headline: 'Textura e luz no espaço',
        body: 'Uma composição coerente com a aplicação e o uso previsto.',
        image: scene(n),
        imageAlt: 'Ambiente ilustrativo gerado',
        cta: { label: 'Ver materiais', href: '/materiais' },
      })),
      presentation: { tone: 'soft' },
    },
  });
  return pages;
}
const rules = (pages, library = images, mode = 'publish') =>
  lintSite(pages, library, mode).map((f) => f.rule);

await test('aceita três páginas úteis conectadas e duas fotos geradas aprovadas', () =>
  assert.deepEqual(rules(rich()), []));
await test('obrigado e paid_lp não completam o mínimo orgânico', () => {
  const pages = project();
  pages[1].type = 'thank_you';
  pages[2].type = 'paid_lp';
  assert.ok(rules(pages).includes('inbound-paginas'));
});
await test('repetir a mesma foto não satisfaz duas imagens', () => {
  const pages = project();
  pages[0].blocks[1].props.secondaryImage = scene(1);
  assert.ok(rules(pages).includes('home-imagens-geradas'));
});
await test('imagem de outro tenant ou upload não conta como geração própria', () => {
  assert.ok(
    rules(project(), images.slice(0, 1)).includes('home-imagens-geradas'),
  );
  assert.ok(
    rules(
      project(),
      images.map((i) => ({ ...i, blobPath: 'uploads/file.webp' })),
    ).includes('home-imagens-geradas'),
  );
});
await test('candidatas podem ser compostas no rascunho e bloqueiam publicação', () => {
  const candidates = images.map((i) => ({
    ...i,
    status: 'candidata',
    critique: { aprovado: true },
  }));
  assert.deepEqual(rules(rich(), candidates, 'draft'), []);
  assert.ok(rules(rich(), candidates).includes('imagens-aprovacao'));
});
await test('imagem em props inválidas ou segunda imagem oculta não conta', () => {
  const pages = project();
  pages[0].blocks[1].props.layout = 'split';
  assert.deepEqual(pageImageUrls(pages[0].blocks), [scene(1)]);
  pages[0].blocks[1].props.layout = 'inventado';
  assert.deepEqual(pageImageUrls(pages[0].blocks), []);
});
await test('ciclo isolado entre duas páginas não torna a jornada conectada', () => {
  const pages = project();
  pages[0].blocks[0].props.links = [];
  pages[0].blocks[1].props.cta.href = '#inicio';
  pages[0].blocks[1].props.anchor = 'inicio';
  assert.ok(rules(pages).includes('pagina-isolada'));
});
await test('bloqueia destinos e âncoras inexistentes', () => {
  const pages = project();
  pages[0].blocks[0].props.links.push(
    { label: 'Ausente', href: '/ausente' },
    { label: 'Âncora', href: '/materiais#inexistente' },
  );
  assert.ok(rules(pages).includes('link-interno'));
  assert.ok(rules(pages).includes('anchor-inexistente'));
});
await test('link com codificação inválida vira recusa, sem derrubar o pre-flight', () => {
  const pages = project();
  pages[0].blocks[0].props.links.push({ label: 'Inválido', href: '/%zz' });
  assert.ok(rules(pages).includes('link-interno'));
});
await test('publicação pontual não conta páginas disponíveis apenas em rascunho', () => {
  const pages = rich().map((p, i) => ({
    ...p,
    id: `p${i}`,
    publishedBlocks: null,
    publishedSeo: null,
  }));
  assert.ok(
    rules(publicationState(pages, new Set(['p0']))).includes('inbound-paginas'),
  );
  assert.deepEqual(
    rules(publicationState(pages, new Set(pages.map((p) => p.id)))),
    [],
  );
});
await test('páginas fora do lote são verificadas com os blocos e SEO publicados', () => {
  const pages = rich().map((p, i) => ({
    ...p,
    id: `p${i}`,
    publishedBlocks: structuredClone(p.blocks),
    publishedSeo: p.seo,
  }));
  pages[1].publishedSeo = { ...pages[1].seo, noindex: true };
  assert.ok(
    rules(publicationState(pages, new Set(['p0']))).includes('inbound-paginas'),
  );
  assert.deepEqual(rules(publicationState(pages, new Set(['p0', 'p1']))), []);
});
await test('páginas sem conteúdo, intenção ou etapas distintas são recusadas', () => {
  const pages = project();
  pages[1].blocks[2].props.body = 'Pouco conteúdo';
  pages[2].meta.inbound = pages[0].meta.inbound;
  const result = rules(pages);
  assert.ok(result.includes('inbound-conteudo'));
  assert.ok(result.includes('inbound-repetido'));
  assert.ok(result.includes('inbound-jornada'));
});
await test('bloqueia título e conteúdo duplicados', () => {
  const pages = project();
  pages[2].blocks = structuredClone(pages[1].blocks);
  pages[2].seo.title = pages[1].seo.title;
  assert.ok(rules(pages).includes('seo-repetido'));
  assert.ok(rules(pages).includes('inbound-copia'));
});
await test('novos blocos aceitam composição válida e recusam imagem inválida', () => {
  const valid = {
    title: 'Escolha o ambiente',
    items: [1, 2].map((n) => ({
      title: `Ambiente ${n}`,
      headline: 'Textura e luz no espaço',
      body: 'Uma composição coerente com a aplicação e o uso.',
      image: scene(n),
      imageAlt: 'Ambiente ilustrativo',
      cta: { label: 'Saiba mais', href: '/materiais' },
    })),
  };
  assert.ok(blockSchemas['feature.explorer'].safeParse(valid).success);
  valid.items[0].image = 'javascript:alert(1)';
  assert.equal(
    blockSchemas['feature.explorer'].safeParse(valid).success,
    false,
  );
});

const { repairSiteDraft, repairSiteInput, buildSiteInput } = await j.import(
  '../lib/ai/site-draft.ts',
);
const { lintPage } = await j.import('../lib/taste/lint.ts');
await test('altura do logo é opcional, limitada e disponível no catálogo e pre-flight', () => {
  for (const type of ['nav.bar', 'footer.compact']) {
    const base = { logoText: 'Estúdio', links: [] };
    assert.deepEqual(blockSchemas[type].parse(base), base);
    for (const height of [16, 50, 160]) {
      const props = { ...base, logoHeight: height };
      assert.equal(blockSchemas[type].parse(props).logoHeight, height);
      const page = project()[0];
      page.blocks = [{ id: 'logo', type, props }];
      assert.equal(
        lintPage(page).some((f) => f.rule === 'props-invalidas'),
        false,
      );
    }
    for (const height of [0, 15, 161, 50.5, '50px', null]) {
      const props = { ...base, logoHeight: height };
      assert.equal(blockSchemas[type].safeParse(props).success, false);
      const page = project()[0];
      page.blocks = [{ id: 'logo', type, props }];
      assert.ok(lintPage(page).some((f) => f.rule === 'props-invalidas'));
    }
    const lines = catalogForPrompt().split('\n');
    const at = lines.findIndex((line) => line.startsWith(`${type} · `));
    assert.ok(at >= 0, `catálogo sem entrada de ${type}`);
    assert.ok(lines[at + 1].includes('logoHeight?:int[16..160]'));
  }
});

function draft() {
  return {
    pages: project().map((p) => ({
      slug: p.slug,
      type: p.type,
      title: p.title,
      inbound: p.meta.inbound,
      seoTitle: p.seo.title,
      seoDescription: p.seo.description,
      blocks: p.blocks.map(({ type, props }) => ({ type, props })),
    })),
  };
}
await test('reparo conserva páginas e props inalteradas, mescla apresentação e revalida o lote', () => {
  const original = draft();
  original.pages[0].blocks[1].props.presentation = {
    tone: 'accent',
    motion: 'image',
  };
  const before = structuredClone(original);
  const result = repairSiteDraft(
    original,
    repairSiteInput.parse({
      changes: [
        {
          kind: 'block',
          page: '/',
          block: 1,
          props: {
            headline: 'Outra composição',
            presentation: { width: 'wide' },
          },
        },
        {
          kind: 'page',
          page: 'materiais',
          seoTitle: 'Materiais para o projeto',
        },
      ],
    }),
  );
  assert.deepEqual(original, before);
  assert.deepEqual(result.pages[2], original.pages[2]);
  assert.equal(
    result.pages[0].blocks[1].props.image,
    original.pages[0].blocks[1].props.image,
  );
  assert.deepEqual(result.pages[0].blocks[1].props.presentation, {
    tone: 'accent',
    motion: 'image',
    width: 'wide',
  });
  assert.equal(result.pages[1].seoTitle, 'Materiais para o projeto');
  assert.ok(buildSiteInput.safeParse(result).success);
});
await test('reparo inválido não altera o lote nem alcança outra página', () => {
  const original = draft(),
    before = structuredClone(original);
  assert.throws(
    () =>
      repairSiteDraft(original, {
        changes: [
          {
            kind: 'block',
            page: '',
            block: 1,
            props: { headline: 'Tentativa' },
          },
          { kind: 'block', page: 'fora-do-lote', block: 0, props: {} },
        ],
      }),
    /ausente/,
  );
  assert.deepEqual(original, before);
  assert.throws(
    () =>
      repairSiteDraft(original, {
        changes: [{ kind: 'block', page: '', block: 99, props: {} }],
      }),
    /não existe/,
  );
});
await test('reparo remove props inválidas sem afrouxar o schema do bloco', () => {
  const original = draft();
  original.pages[0].blocks[1].props.inexistente = true;
  assert.ok(
    lintPage({ ...project()[0], blocks: original.pages[0].blocks }).some(
      (f) => f.rule === 'props-invalidas',
    ),
  );
  const result = repairSiteDraft(original, {
    changes: [
      { kind: 'block', page: '', block: 1, props: {}, unset: ['inexistente'] },
    ],
  });
  assert.equal(
    lintPage({ ...project()[0], blocks: result.pages[0].blocks }).some(
      (f) => f.rule === 'props-invalidas',
    ),
    false,
  );
});
await test('motion sozinho não substitui decisões de composição v2', () => {
  const page = project()[0];
  page.blocks[1].props.presentation = { motion: 'image' };
  page.blocks[2].props.presentation = { motion: 'reveal' };
  assert.ok(
    lintPage(page, { version: 2 }).some((f) => f.rule === 'ritmo-generico'),
  );
  page.blocks[1].props.presentation.tone = 'paper';
  page.blocks[2].props.presentation.tone = 'accent';
  assert.equal(
    lintPage(page, { version: 2 }).some((f) => f.rule === 'ritmo-generico'),
    false,
  );
});

await test('ferramenta de reparo isola o lote por instância e preserva a recusa antes de gravar', async () => {
  const jt = createJiti(import.meta.url, {
    alias: { '@': new URL('..', import.meta.url).pathname.replace(/\/$/, '') },
  });
  const { buildTools } = await jt.import('../lib/ai/tools.ts');
  const tenant = {
    id: 'test-draft-only',
    slug: 'test-draft-only',
    name: 'Teste',
    brief: {},
    dials: { motion: 6, variance: 7, density: 5 },
    brand: {
      design: {
        version: 2,
        concept: 'Composição para o teste',
        signatureElement: 'Recorte fotográfico no hero',
        displayFont: 'geometric',
        bodyFont: 'sans',
        heroComposition: 'split',
        navigation: 'bar',
        rhythm: 'compact',
        imageTreatment: 'full-bleed',
        surfaceStyle: 'flat',
        motif: 'none',
      },
    },
  };
  const first = buildTools(tenant),
    other = buildTools({ ...tenant, id: 'test-other' });
  const rejected = await first.build_site.execute(draft());
  assert.equal(rejected.ok, false, JSON.stringify(rejected));
  assert.ok(rejected.pages.every((p) => p.preflight.includes('sem-conversao')));
  assert.deepEqual(rejected.pages[0].blocks[1], {
    index: 1,
    type: 'hero.split',
  });
  const change = {
    changes: [
      {
        kind: 'block',
        page: '',
        block: 1,
        props: { presentation: { tone: 'paper' } },
      },
    ],
  };
  assert.match((await other.repair_site.execute(change)).error, /Não há lote/);
  assert.match(
    (
      await first.repair_site.execute({
        changes: [{ kind: 'block', page: 'outro-tenant', block: 0, props: {} }],
      })
    ).error,
    /ausente/,
  );
  const stillRejected = await first.repair_site.execute(change);
  assert.equal(stillRejected.ok, false);
  assert.ok(
    stillRejected.pages.some((p) => p.preflight.includes('sem-conversao')),
  );
});

await test('painel distingue lote recusado de projeto salvo', async () => {
  const jui = createJiti(import.meta.url, { jsx: true });
  const { describeTool } = await jui.import(
    '../app/(admin)/admin/[tenant]/chat-parts.tsx',
  );
  for (const name of ['build_site', 'repair_site']) {
    assert.equal(
      describeTool(
        name,
        {},
        { ok: false, pages: [{ page: '/', preflight: 'ERRO' }] },
        'output-available',
      ),
      'O projeto precisa de ajustes antes de salvar',
    );
    assert.equal(
      describeTool(
        name,
        {},
        { ok: true, pages: [{}, {}, {}], publicationPending: [] },
        'output-available',
      ),
      'Projeto salvo: 3 páginas',
    );
  }
});

const { siteMetrics, structuralFindings } = await j.import(
  '../lib/taste/metrics.ts',
);
const { expectedRatio, ratioFits } = await j.import('../lib/images/ratios.ts');

await test('home sem seção protagonista com fotos é recusada', () => {
  // project() é a home pobre: hero com fotos e o resto em texto.
  assert.ok(rules(project()).includes('home-protagonista'));
  assert.equal(rules(rich()).includes('home-protagonista'), false);
  assert.equal(siteMetrics(project(), images).home.protagonist, null);
  assert.equal(
    siteMetrics(rich(), images).home.protagonist,
    'feature.explorer',
  );
});

await test('hero atelier sustenta a home quando o miolo também mostra o negócio', () => {
  const pages = project();
  pages[0].blocks.push({
    id: 'media',
    type: 'media.image',
    props: {
      src: scene(2),
      alt: 'Cena ilustrativa gerada',
      caption: 'Ambiente ilustrativo gerado para inspiração.',
      presentation: { tone: 'soft' },
    },
  });
  assert.equal(rules(pages).includes('home-protagonista'), false);
  assert.equal(siteMetrics(pages, images).home.protagonist, 'hero.split');
});

await test('página orgânica sem nenhuma imagem é recusada', () => {
  const pages = rich();
  delete pages[1].blocks[1].props.image;
  delete pages[1].blocks[1].props.imageAlt;
  delete pages[1].blocks[1].props.secondaryImage;
  delete pages[1].blocks[1].props.secondaryImageAlt;
  const found = lintSite(pages, images, 'draft').filter(
    (f) => f.rule === 'pagina-sem-foto',
  );
  assert.equal(found.length, 1);
  assert.equal(found[0].page, '/materiais');
  assert.equal(rules(rich()).includes('pagina-sem-foto'), false);
});

await test('proporção incoerente com o layout vira aviso com o bloco apontado', () => {
  // O defeito real: foto 4:3 servida num hero editorial, que exibe 16:9.
  const library = images.map((i) => ({ ...i, ratio: '4:5' }));
  const pages = rich();
  pages[0].blocks[1].props.layout = 'editorial';
  const found = structuralFindings(pages, library).filter(
    (f) => f.rule === 'imagem-proporcao',
  );
  assert.ok(found.length >= 1);
  assert.equal(found[0].level, 'warn');
  assert.equal(found[0].blockType, 'hero.split');
  assert.equal(found[0].blockIndex, 0);
  assert.ok(found[0].message.includes('16:9'));
  // Na composição atelier a mesma foto vertical está correta; o aviso que
  // sobra é do explorer, que exibe paisagem e recebeu retrato.
  const atelier = structuralFindings(rich(), library);
  assert.equal(
    atelier.some(
      (f) => f.rule === 'imagem-proporcao' && f.blockType === 'hero.split',
    ),
    false,
  );
  assert.ok(
    atelier.some(
      (f) =>
        f.rule === 'imagem-proporcao' && f.blockType === 'feature.explorer',
    ),
  );
});

await test('proporção esperada acompanha a variante de layout', () => {
  assert.equal(expectedRatio('hero.split', 'atelier'), '4:5');
  assert.equal(expectedRatio('hero.split', 'editorial'), '16:9');
  assert.equal(expectedRatio('hero.split', 'cover'), '16:9');
  assert.equal(expectedRatio('narrative.split'), '5:6');
  assert.equal(expectedRatio('narrative.split', 'editorial'), '16:9');
  assert.equal(expectedRatio('media.image', 'portrait'), '4:5');
  assert.equal(expectedRatio('media.image', 'bleed'), '16:9');
  assert.equal(expectedRatio('feature.explorer'), '4:3');
  assert.equal(expectedRatio('editorial.resources'), '16:9');
  assert.equal(expectedRatio('hero.atelier'), '4:5');
  assert.equal(ratioFits('4:5', '5:6'), true);
  assert.equal(ratioFits('4:3', '16:9'), false);
  assert.equal(ratioFits('16:9', '4:5'), false);
});

await test('home com um tom só recebe aviso de ritmo', () => {
  const pages = rich();
  pages[0].blocks[2].props.presentation = { tone: 'accent' };
  pages[0].blocks[3].props.presentation = { tone: 'accent' };
  const found = lintSite(pages, images, 'draft').filter(
    (f) => f.rule === 'home-tons',
  );
  assert.equal(found.length, 1);
  assert.equal(found[0].level, 'warn');
  assert.equal(rules(rich()).includes('home-tons'), false);
});

await test('duas seções iguais em sequência viram aviso de repetição', () => {
  const pages = rich();
  pages[0].blocks.splice(3, 0, structuredClone(pages[0].blocks[2]));
  pages[0].blocks[3].id = 'text-2';
  const found = structuralFindings(pages, images).filter(
    (f) => f.rule === 'layout-repetido',
  );
  assert.equal(found.length, 1);
  assert.equal(found[0].blockType, 'editorial.text');
});

await test('catálogo entrega uso e proporção de cada bloco ao agente', () => {
  const catalog = catalogForPrompt();
  assert.ok(catalog.includes('feature.explorer · Compara aplicações'));
  assert.ok(catalog.includes('feature.explorer'));
  const explorer = catalog
    .split('\n')
    .find((line) => line.startsWith('feature.explorer · '));
  assert.ok(explorer.includes('[foto 4:3]'));
  const hero = catalog
    .split('\n')
    .find((line) => line.startsWith('hero.split · '));
  assert.ok(hero.includes('4:5 em split/poster/offset/atelier'));
  assert.ok(hero.includes('16:9 em cover/editorial'));
});

await test('gate de composição v2 acompanha o tamanho da página', () => {
  const design = { version: 2 };
  const section = (n) => ({
    id: `s${n}`,
    type: 'editorial.text',
    props: { body: `Conteúdo específico da seção ${n}.` },
  });
  const page = (count) => ({
    type: 'page',
    title: 'Página',
    seo: { title: 'Página' },
    blocks: [
      ...Array.from({ length: count }, (_, i) => section(i)),
      {
        id: 'cta',
        type: 'cta.band',
        props: {
          title: 'Fale com a equipe',
          cta: { label: 'Falar', href: '/#contato' },
        },
      },
    ],
  });
  const required = (count, rule) =>
    lintPage(page(count), design).find((f) => f.rule === rule)?.message ?? '';
  // 8 seções: o teto antigo pedia 3 layouts; agora pede 5 e 4 apresentações.
  assert.ok(required(7, 'composicao-generica').includes('pelo menos 4'));
  assert.ok(required(9, 'composicao-generica').includes('pelo menos 5'));
  assert.ok(required(9, 'ritmo-generico').includes('pelo menos 4'));
  assert.ok(required(3, 'composicao-generica').includes('pelo menos 2'));
});

const { extractReference, metaContent, readReference } = await j.import(
  '../lib/ai/reference.ts',
);
const { normalizeSocialUrl, socialSummary } = await j.import(
  '../lib/social-profile.ts',
);
const { parseSocialProfile, readSocialProfile, referenceFromSocial } =
  await j.import('../lib/ai/social.ts');
const { intakeSchema, intakeSocialUrl, intakeSummary, lines } = await j.import(
  '../lib/tenant-intake.ts',
);
const { scenePlan, sceneCoverage } = await j.import(
  '../lib/images/scene-plan.ts',
);
const { nextPhase, PHASE_TOOLS } = await j.import('../lib/taste/phases.ts');

await test('referência em rede social com login volta inacessível sem requisição', async () => {
  let called = 0;
  const fetchSpy = async () => {
    called += 1;
    return new Response('<html></html>');
  };
  for (const url of [
    'https://www.facebook.com/oficina/?locale=pt_BR',
    'https://instagram.com/oficina',
  ]) {
    const reference = await readReference(url, { fetch: fetchSpy });
    assert.equal(reference.status, 'inacessivel');
    assert.ok(reference.motivo.includes('login'));
  }
  assert.equal(called, 0);
});

await test('referência para rede interna ou protocolo estranho é recusada', async () => {
  let called = 0;
  const fetchSpy = async () => {
    called += 1;
    return new Response('<html></html>');
  };
  const local = await readReference('http://intranet.local/', {
    fetch: fetchSpy,
    lookup: async () => ({ address: '10.0.0.5', family: 4 }),
  });
  assert.equal(local.status, 'inacessivel');
  assert.equal(local.motivo, 'Endereço de rede interna');
  const scheme = await readReference('file:///etc/passwd', { fetch: fetchSpy });
  assert.equal(scheme.status, 'inacessivel');
  assert.equal(called, 0);
});

await test('extração de referência devolve título, texto e contatos reais', () => {
  const reference = extractReference(
    'https://oficina.test/',
    `<html><head><title>Oficina Sabi&aacute;</title>
     <meta name="description" content="Manuten&ccedil;&atilde;o e diagn&oacute;stico"></head>
     <body><script>var x = "ignorar"</script>
     <h1>Mec&acirc;nica de confian&ccedil;a</h1>
     <p>Atendemos carros nacionais e importados com diagnóstico eletrônico e revisão programada.</p>
     <p>curto</p>
     <a href="https://wa.me/5511999998888">WhatsApp</a>
     <span>(11) 4002-8922</span></body></html>`,
  );
  assert.equal(reference.status, 'ok');
  assert.equal(reference.titulo, 'Oficina Sabiá');
  assert.equal(reference.descricao, 'Manutenção e diagnóstico');
  assert.ok(reference.texto.includes('Mecânica de confiança'));
  assert.ok(reference.texto.includes('diagnóstico eletrônico'));
  assert.equal(reference.texto.includes('ignorar'), false);
  assert.equal(reference.texto.includes('curto'), false);
  assert.deepEqual(reference.whatsapp, ['wa.me/5511999998888']);
  assert.ok(reference.telefones.includes('(11) 4002-8922'));
});

await test('intake do operador vira resumo legível e ignora linha vazia', () => {
  const intake = intakeSchema.parse({
    segment: 'oficina mecânica',
    audience: 'motoristas de São Paulo',
    evidence: lines('Diagnóstico eletrônico\n\n  \nRevisão programada'),
    references: [],
  });
  assert.deepEqual(intake.evidence, [
    'Diagnóstico eletrônico',
    'Revisão programada',
  ]);
  const summary = intakeSummary(intake);
  assert.ok(summary.includes('Segmento: oficina mecânica'));
  assert.ok(summary.includes('Diagnóstico eletrônico; Revisão programada'));
  assert.equal(intakeSummary({}), '');
});

await test('plano de cenas cobre abertura, protagonista e páginas internas', () => {
  const atelier = scenePlan({ heroComposition: 'atelier' }, 3);
  assert.deepEqual(
    atelier.map((scene) => scene.role),
    [
      'hero',
      'hero-detail',
      'protagonista',
      'protagonista',
      'subpagina',
      'subpagina',
    ],
  );
  assert.equal(atelier[0].ratio, '4:5');
  assert.equal(atelier[2].targetBlock, 'feature.explorer');
  assert.equal(atelier[2].ratio, '4:3');
  const editorial = scenePlan({ heroComposition: 'editorial' }, 3);
  assert.equal(editorial[0].targetBlock, 'hero.editorial');
  assert.equal(editorial[0].ratio, '16:9');
  assert.equal(
    editorial.some((scene) => scene.role === 'hero-detail'),
    false,
  );
});

await test('a cobertura casa biblioteca aprovada com as vagas do plano', () => {
  const plan = scenePlan({ heroComposition: 'split' }, 3);
  const photo = (targetBlock, ratio) => ({ targetBlock, ratio });
  const exatas = plan.map((slot) => photo(slot.targetBlock, slot.ratio));
  assert.equal(sceneCoverage(plan, exatas).missing.length, 0);

  // Faltando a segunda aplicação, a próxima vaga é a que o plano pede.
  const parcial = sceneCoverage(plan, exatas.slice(0, 2));
  assert.equal(parcial.covered.length, 2);
  assert.equal(parcial.missing[0].role, 'protagonista');
  assert.equal(parcial.missing[0].targetBlock, 'feature.explorer');

  // Foto antiga de outro hero 4:5 cobre a vaga sem obrigar geração paga.
  const offset = scenePlan({ heroComposition: 'offset' }, 3);
  const herdada = sceneCoverage(offset, [photo('hero.split', '4:5')]);
  assert.equal(herdada.covered.length, 1);
  assert.equal(herdada.covered[0].role, 'hero');
  // Mesmo bloco, proporção errada, não cobre a abertura: o recorte comeria a
  // cena. Ela cai na vaga panorâmica, que é onde serve.
  const torta = sceneCoverage(offset, [photo('hero.offset', '16:9')]);
  assert.equal(torta.missing[0].role, 'hero');
  assert.equal(torta.covered[0].targetBlock, 'media.image');
  // Proporção ausente ou fora do vocabulário também não vale por cobertura.
  for (const ratio of [undefined, '', '3:2'])
    assert.equal(
      sceneCoverage(offset, [photo('hero.offset', ratio)]).covered.length,
      0,
      String(ratio),
    );
  // Uma foto panorâmica ocupa a vaga panorâmica, não a abertura em retrato.
  const panoramica = sceneCoverage(offset, [photo('media.image', '16:9')]);
  assert.equal(panoramica.covered[0].targetBlock, 'media.image');
  assert.equal(panoramica.missing[0].role, 'hero');

  // As duas vagas do atelier precisam de duas fotos, não de uma repetida.
  const atelier = scenePlan({ heroComposition: 'atelier' }, 3);
  assert.equal(
    sceneCoverage(atelier, [photo('hero.atelier', '4:5')]).missing[0].role,
    'hero-detail',
  );
});

await test('a próxima etapa vem do estado persistido, não da conversa', () => {
  const base = {
    hasDesign: true,
    coveredScenes: 6,
    targetScenes: 6,
    organicPages: 3,
    blockingErrors: 0,
    reviewRounds: 1,
  };
  const novo = { ...base, organicPages: 0 };
  assert.equal(nextPhase({ ...base, hasDesign: false }), 'briefing');
  assert.equal(nextPhase({ ...novo, coveredScenes: 1 }), 'cenas');
  // Sem atalho: uma vaga aberta mantém a etapa de cenas.
  assert.equal(nextPhase({ ...novo, coveredScenes: 5 }), 'cenas');
  assert.equal(nextPhase({ ...base, organicPages: 1 }), 'composicao');
  // Com as páginas montadas, biblioteca menor que o plano não reabre a etapa
  // de cenas: foto faltando vira erro de pre-flight, tratado na revisão.
  assert.equal(nextPhase({ ...base, coveredScenes: 1 }), 'pronto');
  assert.equal(
    nextPhase({ ...base, coveredScenes: 1, blockingErrors: 1 }),
    'revisao',
  );
  assert.equal(nextPhase({ ...base, reviewRounds: 0 }), 'revisao');
  assert.equal(nextPhase({ ...base, blockingErrors: 2 }), 'revisao');
  assert.equal(nextPhase(base), 'pronto');
  // A composição não fica disponível antes da direção existir.
  assert.equal(PHASE_TOOLS.briefing.includes('build_site'), false);
  assert.equal(PHASE_TOOLS.composicao.includes('publish_site'), false);
  assert.equal(PHASE_TOOLS.revisao.includes('review_pages'), true);
  // A cobertura já vai no prompt da fase; e logo não é etapa da geração.
  assert.equal(PHASE_TOOLS.cenas.includes('list_images'), false);
  for (const tools of Object.values(PHASE_TOOLS))
    assert.equal(tools.includes('generate_logo'), false);
});

const { generationState } = await j.import('../lib/sites/generation.ts');

const tenantComDirecao = {
  brand: {
    design: {
      version: 2,
      concept: 'Oficina que mostra o serviço acontecendo',
      signatureElement: 'Faixa diagonal de cor sobre a foto de abertura',
      displayFont: 'geometric',
      bodyFont: 'sans',
      heroComposition: 'split',
      navigation: 'bar',
      rhythm: 'alternating',
      imageTreatment: 'full-bleed',
      surfaceStyle: 'flat',
      motif: 'grid',
    },
  },
  brief: { generation: { reviewRounds: 1 } },
};
const paginasRicas = () =>
  rich().map((page) => ({
    ...page,
    id: page.slug || 'home',
    publishedBlocks: null,
    publishedSeo: null,
  }));
/**
 * Biblioteca que cobre o plano inteiro do hero split, vaga por vaga. As duas
 * primeiras são as fotos que a home do fixture referencia.
 */
const VAGAS = [
  ['hero.split', '4:5'],
  ['feature.explorer', '4:3'],
  ['feature.explorer', '4:3'],
  ['narrative.split', '5:6'],
  ['media.image', '16:9'],
];
const biblioteca = () =>
  VAGAS.map(([targetBlock, ratio], index) => {
    const seq = index + 1;
    return {
      ...images[0],
      id: `img-${seq}`,
      seq,
      url: scene(seq),
      blobPath: `tenants/sample/gerado/batch/${seq}.webp`,
      createdAt: `2026-09-0${seq}T10:00:00.000Z`,
      targetBlock,
      ratio,
    };
  });

await test('só imagem aprovada cobre vaga do plano e libera a composição', () => {
  const pages = paginasRicas();
  const aprovadas = generationState(tenantComDirecao, pages, biblioteca());
  assert.equal(aprovadas.targetScenes, 5);
  assert.equal(aprovadas.coveredScenes, 5);
  assert.equal(aprovadas.nextScene, null);
  // Com o plano coberto a etapa de cenas fecha; o que sobra é trabalho do
  // agente na revisão, não decisão de imagem.
  assert.notEqual(aprovadas.next, 'cenas');
  assert.equal(aprovadas.pendingImages.length, 0);

  const candidatas = generationState(
    tenantComDirecao,
    pages,
    biblioteca().map((image) => ({ ...image, status: 'candidata' })),
  );
  // A candidata continua sem ser trabalho do agente, mas não cobre vaga.
  assert.equal(candidatas.blockingErrors, aprovadas.blockingErrors);
  assert.equal(candidatas.coveredScenes, 0);
  assert.equal(candidatas.pendingImages.length, 5);
  // Antes da composição é isso que mantém a etapa de cenas aberta até o
  // operador decidir; com as páginas montadas o fluxo segue para a revisão.
  const semPaginas = generationState(
    tenantComDirecao,
    [],
    biblioteca().map((image) => ({ ...image, status: 'candidata' })),
  );
  assert.equal(semPaginas.next, 'cenas');
  assert.equal(candidatas.next, 'revisao');
  // Candidata fora do rascunho também aguarda decisão, e a mais antiga vem
  // primeiro: o painel decide uma por vez.
  assert.equal(candidatas.pendingImages[0].seq, 1);
  assert.equal(candidatas.pendingImages[0].usedInDraft, true);
  assert.equal(candidatas.pendingImages[4].usedInDraft, false);
  assert.equal(candidatas.pendingImages[0].role, 'hero');
  assert.deepEqual(candidatas.pendingImages[0].problemas, []);

  // Um erro que o agente resolve continua levando de volta para a revisão.
  const semFoto = structuredClone(pages);
  semFoto[1].blocks = semFoto[1].blocks.filter((b) => b.type !== 'hero.split');
  assert.ok(
    generationState(tenantComDirecao, semFoto, biblioteca()).blockingErrors >
      aprovadas.blockingErrors,
  );
});

await test('o plano não cresce com as páginas gravadas', () => {
  // Com quatro páginas orgânicas o plano continua medindo três: crescer aqui
  // devolveria a geração para a etapa de cenas logo depois da composição.
  const pages = paginasRicas();
  const extra = structuredClone(pages[1]);
  extra.slug = 'processo';
  extra.id = 'processo';
  extra.seo = {
    title: 'Título específico do processo',
    description: 'Descrição específica da página de processo.',
  };
  const state = generationState(
    tenantComDirecao,
    [...pages, extra],
    biblioteca(),
  );
  assert.equal(state.targetScenes, 5);
  assert.equal(state.coveredScenes, 5);
  assert.notEqual(state.next, 'cenas');
});

await test('perfil de rede social é normalizado; outros hosts continuam fora do campo', () => {
  assert.deepEqual(normalizeSocialUrl('@Oficina.Sabia'), {
    url: 'https://www.instagram.com/oficina.sabia/',
    network: 'instagram',
    handle: 'oficina.sabia',
  });
  assert.equal(
    normalizeSocialUrl('instagram.com/oficina/?hl=pt').url,
    'https://www.instagram.com/oficina/',
  );
  assert.equal(
    normalizeSocialUrl('https://www.linkedin.com/company/Porto-Pedras/about/')
      .url,
    'https://www.linkedin.com/company/porto-pedras/',
  );
  assert.equal(
    normalizeSocialUrl('linkedin.com/in/pessoa').network,
    'linkedin',
  );
  for (const input of [
    '',
    'facebook.com/oficina',
    'https://oficina.test/',
    'instagram.com/p/Cabc123/',
    'linkedin.com/feed/',
  ])
    assert.equal(normalizeSocialUrl(input), null, input);
});

await test('meta lê o conteúdo da própria tag, com apóstrofo e ordem invertida', () => {
  const html = `<meta property="og:description" content="Bio d'água e sol">
    <meta name='description' content='Segunda leitura'>`;
  assert.equal(metaContent(html, 'og:description'), "Bio d'água e sol");
  assert.equal(metaContent(html, 'description'), 'Segunda leitura');
  // Atributos invertidos, como o Instagram escreve.
  assert.equal(
    metaContent(
      '<meta content="Perfil real" name="description" />',
      'description',
    ),
    'Perfil real',
  );
  // O LinkedIn entrega a bio codificada duas vezes: &amp;#39; é um apóstrofo.
  assert.equal(
    metaContent(
      '<meta name="description" content="ship what&amp;#39;s next" />',
      'description',
    ),
    "ship what's next",
  );
  // Uma entidade só continua com uma passada, sem estragar &amp;lt;.
  assert.equal(
    metaContent(
      '<meta name="description" content="a &amp;lt; b" />',
      'description',
    ),
    'a &lt; b',
  );
  // Sem a tag pedida, o padrão não pode varrer as tags anteriores.
  const semAlvo = `<meta name="robots" content="noarchive" /><meta charset="utf-8" />
    <meta property="og:title" content="Só título" />`;
  assert.equal(metaContent(semAlvo, 'description'), undefined);
  assert.equal(metaContent(semAlvo, 'og:title'), 'Só título');
});

await test('Instagram devolve nome, bio e avatar; casca de login vira bloqueio', () => {
  const lidoEm = '2026-09-10T12:00:00.000Z';
  const perfil = parseSocialProfile(
    normalizeSocialUrl('@padaria'),
    `<meta property="og:title" content="Padaria Santa Luzia (&#064;padaria) &#x2022; Instagram photos and videos" />
     <meta name="description" content="3,２01 Followers, 180 Following, 96 Posts - Padaria Santa Luzia on Instagram: &quot;P&atilde;o d'água todo dia &#xe0;s 6h&quot;" />
     <meta property="og:image" content="https://scontent.cdninstagram.com/v/avatar.jpg?token=1" />`,
    lidoEm,
  );
  assert.equal(perfil.status, 'ok');
  assert.equal(perfil.name, 'Padaria Santa Luzia');
  assert.equal(perfil.bio, "Pão d'água todo dia às 6h");
  assert.equal(
    perfil.sourceImage,
    'https://scontent.cdninstagram.com/v/avatar.jpg?token=1',
  );
  assert.equal(perfil.lidoEm, lidoEm);

  const casca = parseSocialProfile(
    normalizeSocialUrl('@padaria'),
    '<html><head><title>Instagram</title></head><body>challenge checkpoint</body></html>',
    lidoEm,
  );
  assert.equal(casca.status, 'inacessivel');
  assert.ok(casca.motivo.includes('login'));
  assert.equal(casca.sourceImage, undefined);
});

await test('LinkedIn de empresa devolve nome e tagline sem o prefixo de seguidores', () => {
  const perfil = parseSocialProfile(
    normalizeSocialUrl('linkedin.com/company/porto-pedras'),
    `<meta property="og:title" content="Porto Pedras | LinkedIn">
     <meta name="description" content="Porto Pedras | 1,240 followers on LinkedIn. Pedras naturais para arquitetura">
     <meta property="og:image" content="https://media.licdn.com/logo.png">`,
    '2026-09-10T12:00:00.000Z',
  );
  assert.equal(perfil.status, 'ok');
  assert.equal(perfil.name, 'Porto Pedras');
  assert.equal(perfil.bio, 'Pedras naturais para arquitetura');
  assert.equal(perfil.followers, '1,240 seguidores');
});

await test('resposta 999 do LinkedIn vira bloqueio explícito, sem segunda requisição', async () => {
  let called = 0;
  const reference = await readSocialProfile(
    normalizeSocialUrl('linkedin.com/in/pessoa'),
    {
      // O construtor Response recusa 999; o LinkedIn responde exatamente isso.
      fetch: async () => {
        called += 1;
        return {
          status: 999,
          ok: false,
          headers: new Headers(),
          text: async () => '',
        };
      },
    },
  );
  assert.equal(called, 1);
  assert.equal(reference.status, 'inacessivel');
  assert.ok(reference.motivo.includes('perfis pessoais'));
});

await test('perfil lido vira referência e resumo; bloqueado vira lacuna declarada', () => {
  const social = {
    url: 'https://www.instagram.com/padaria/',
    network: 'instagram',
    handle: 'padaria',
    status: 'ok',
    name: 'Padaria Santa Luzia',
    bio: 'Pão de fermentação natural',
    followers: '3,201 seguidores',
    avatarNotes: 'Logotipo bege sobre marrom',
    lidoEm: '2026-09-10T12:00:00.000Z',
  };
  const summary = socialSummary(social);
  assert.ok(summary.includes('Padaria Santa Luzia'));
  assert.ok(summary.includes('Pão de fermentação natural'));
  assert.ok(summary.includes('Logotipo bege'));

  const reference = referenceFromSocial(social);
  assert.equal(reference.status, 'ok');
  assert.equal(reference.titulo, 'Padaria Santa Luzia');
  assert.equal(reference.descricao, 'Pão de fermentação natural');

  const bloqueado = socialSummary({
    ...social,
    status: 'inacessivel',
    motivo: 'O Instagram devolveu a tela de login em vez do perfil.',
    bio: undefined,
  });
  assert.ok(bloqueado.includes('não foi possível ler'));
  assert.ok(bloqueado.includes('lacuna'));
  assert.equal(
    referenceFromSocial({ ...social, status: 'inacessivel' }).status,
    'inacessivel',
  );
  assert.equal(socialSummary({ ...social, status: 'lendo' }), '');
  assert.equal(socialSummary({ nada: true }), '');
  // Leitura pendente ainda declara a URL, sem prometer conteúdo.
  const pendente = socialSummary(null, 'https://www.instagram.com/padaria/');
  assert.ok(pendente.includes('instagram.com/padaria'));
  assert.ok(pendente.includes('não terminou'));
  assert.equal(bloqueado.includes('perfil..'), false);
});

await test('intake aceita perfil social, normaliza e recusa outra rede', () => {
  const intake = intakeSchema.parse({ socialUrl: ' @Padaria ' });
  assert.equal(intake.socialUrl, 'https://www.instagram.com/padaria/');
  // A URL fica na linha da rede social, não repetida no resumo do intake.
  assert.equal(intakeSummary(intake).includes('instagram.com/padaria'), false);
  assert.equal(intakeSocialUrl(intake), 'https://www.instagram.com/padaria/');
  const recusado = intakeSchema.safeParse({
    socialUrl: 'facebook.com/padaria',
  });
  assert.equal(recusado.success, false);
  assert.ok(recusado.error.issues[0].message.includes('Instagram'));
  assert.equal(intakeSchema.parse({}).socialUrl, '');
});

await test('ferramentas preservam o perfil e o intake atualizados durante o turno', async () => {
  const old = { intake: { segment: 'Antigo' }, social: { status: 'lendo' } };
  let brief = {
    intake: { segment: 'Atualizado pelo operador' },
    social: { status: 'ok', name: 'Perfil lido' },
  };
  const protectedFields = structuredClone(brief);
  const { buildTools } = await loadModule('lib/ai/tools.ts', {
    '@/lib/db': {
      db:
        () =>
        async (parts, ...values) => {
          if (parts.join('').includes('update tenants'))
            brief = { ...brief, ...JSON.parse(values[0]) };
          return [];
        },
    },
    '@/lib/ai/reference': {
      readReference: async (url) => ({
        url,
        status: 'ok',
        titulo: 'Fonte verificada',
        lidoEm: new Date().toISOString(),
      }),
    },
    '@/lib/tenant-queries': { listPages: async () => rich() },
    '@/lib/images/queries': { listImages: async () => images },
  });
  const tools = buildTools({
    id: 'fixture',
    slug: 'fixture',
    brand: {},
    dials: {},
    brief: old,
  });
  const { designProfileInputSchema } = await j.import(
    '../lib/design/profile.ts',
  );
  const direction = designProfileInputSchema.parse({
    brief: {
      audience: 'Pessoas reformando a casa',
      offer: 'Pedras para arquitetura',
      goal: 'Solicitar orientação',
      personality: ['sóbria', 'natural'],
      evidence: ['Produção própria'],
      constraints: ['Nunca mostrar pessoas'],
    },
    concept: 'Recortes da matéria em escala arquitetônica',
    signatureElement: 'Janela vertical de matéria',
    accent: '#87522a',
    accentAlt: '#315b48',
    ink: '#111111',
    paper: '#ffffff',
    surface: '#eeeeee',
    radius: 'sm',
    displayFont: 'sans',
    bodyFont: 'sans',
    heroComposition: 'split',
    navigation: 'bar',
    rhythm: 'alternating',
    imageTreatment: 'framed',
    surfaceStyle: 'flat',
    motif: 'grid',
    variance: 5,
    motion: 3,
    density: 5,
  });
  for (const [name, input] of [
    ['read_reference', { url: 'https://example.test/' }],
    ['review_pages', {}],
    ['set_design', direction],
  ]) {
    const result = await tools[name].execute(input);
    assert.equal(result.error, undefined, name);
    assert.deepEqual(brief.intake, protectedFields.intake, name);
    assert.deepEqual(brief.social, protectedFields.social, name);
  }
  assert.equal(brief.sources[0].titulo, 'Fonte verificada');
  assert.equal(brief.generation.reviewRounds, 1);
  assert.deepEqual(brief.constraints, ['Nunca mostrar pessoas']);
});

const { systemPrompt } = await j.import('../lib/taste/prompt.ts');
const { designProfileInputSchema: designInput } = await j.import(
  '../lib/design/profile.ts',
);

const modernDirection = {
  brief: {
    audience: 'Times de produto que precisam de previsibilidade',
    offer: 'Implantação e operação de rotina de engenharia',
    goal: 'Agendar uma conversa técnica',
    personality: ['precisa', 'contida'],
    evidence: ['Operação própria desde 2019'],
    constraints: ['Não citar clientes'],
  },
  concept: 'Painel escuro com uma única linha de acento por capítulo',
  signatureElement: 'Régua de 1px separando os capítulos',
  accent: '#4b6bdd',
  accentAlt: '#2f8f6b',
  ink: '#f5f6f8',
  paper: '#0b0c0e',
  surface: '#15171b',
  radius: 'sm',
  displayFont: 'geometric',
  bodyFont: 'sans',
  heroComposition: 'editorial',
  navigation: 'minimal',
  rhythm: 'chapters',
  imageTreatment: 'framed',
  surfaceStyle: 'outlined',
  motif: 'none',
  variance: 3,
  motion: 4,
  density: 4,
};

await test('set_design respeita a faixa da vibe e compara unicidade dentro dela', async () => {
  const queries = [];
  const { buildTools } = await loadModule('lib/ai/tools.ts', {
    '@/lib/db': {
      db:
        () =>
        async (parts, ...values) => {
          queries.push({ sql: parts.join('?'), values });
          return [];
        },
    },
    '@/lib/tenant-queries': { listPages: async () => [] },
    '@/lib/images/queries': { listImages: async () => [] },
  });
  const tools = buildTools({
    id: 'fixture-moderno',
    slug: 'fixture-moderno',
    brand: { vibe: 'moderno' },
    dials: {},
    brief: {},
  });

  const claro = await tools.set_design.execute(
    designInput.parse({
      ...modernDirection,
      ink: '#111111',
      paper: '#ffffff',
      surface: '#eeeeee',
    }),
  );
  assert.match(claro.error, /Moderno/);
  assert.match(claro.error, /paper/);

  const fora = await tools.set_design.execute(
    designInput.parse({
      ...modernDirection,
      displayFont: 'editorial',
      radius: 'full',
    }),
  );
  assert.match(fora.error, /displayFont/);
  assert.match(fora.error, /radius/);

  const ok = await tools.set_design.execute(designInput.parse(modernDirection));
  assert.equal(ok.error, undefined);
  assert.equal(ok.vibe, 'moderno');
  // A comparação de unicidade só olha clientes da mesma vibe: as faixas se
  // sobrepõem em vários eixos e um moderno não repete um ousado.
  const uniqueness = queries.find((query) => query.sql.includes("brand ? 'design'"));
  assert.ok(uniqueness.sql.includes("brand->>'vibe'"));
  assert.ok(uniqueness.values.includes('moderno'));
});

await test('o prompt declara a vibe e os contatos já renderizados', () => {
  const tenant = {
    name: 'Fixture',
    slug: 'fixture',
    brand: { vibe: 'ousado' },
    dials: { variance: 7, motion: 5, density: 4 },
    brief: {},
    imageGuide: {},
    whatsapp: '5511988887777',
    contactEmail: 'oi@fixture.com.br',
    contacts: {
      phones: [{ number: '5511988887777', whatsapp: true }],
      addresses: [{ label: 'Loja', text: 'Rua das Pedras, 100, Bauru' }],
      social: ['https://www.instagram.com/fixture/'],
    },
  };
  const prompt = systemPrompt(tenant, '', '/', '');
  assert.match(prompt, /## Vibe do site: Ousado/);
  assert.match(prompt, /hero\.statement/);
  assert.match(prompt, /Rua das Pedras, 100, Bauru/);
  assert.match(prompt, /oi@fixture\.com\.br/);
  assert.match(prompt, /onde-estamos/);
  assert.match(prompt, /Direção de imagem da vibe/);

  const comercial = systemPrompt({ ...tenant, brand: {} }, '', '/', '');
  assert.match(comercial, /## Vibe do site: Comercial/);
  assert.equal(comercial.includes('11vw'), false);

  // Cliente sem contatos não ganha seção vazia nem quebra o prompt.
  const vazio = systemPrompt(
    { ...tenant, contacts: undefined, whatsapp: null, contactEmail: null },
    '',
    '/',
    '',
  );
  assert.match(vazio, /\(nenhum\)/);
});

await test('a âncora da seção de localização pertence ao cadastro', () => {
  const page = project()[0];
  page.blocks = [
    {
      id: 'mapa',
      type: 'media.map',
      props: {
        address: 'Rua das Pedras, 100',
        query: 'Rua das Pedras, 100',
        anchor: 'onde-estamos',
      },
    },
  ];
  const findings = lintPage(page);
  assert.ok(findings.some((finding) => finding.rule === 'anchor-reservada'));
  page.blocks[0].props.anchor = 'endereco';
  assert.equal(
    lintPage(page).some((finding) => finding.rule === 'anchor-reservada'),
    false,
  );
});

await test('o plano de cenas continua guiado pelo hero do perfil', () => {
  // A vibe ousado abre com hero.statement e reaproveita a cena do hero num
  // media.image bleed: o plano não muda, e a proporção precisa casar.
  assert.deepEqual(
    scenePlan({ heroComposition: 'editorial' }, 3).map((scene) => scene.ratio),
    ['16:9', '4:3', '4:3', '5:6', '16:9'],
  );
  assert.equal(scenePlan({ heroComposition: 'poster' }, 3)[0].ratio, '4:5');
});
