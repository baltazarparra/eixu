import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createJiti } from 'jiti';
import { loadModule } from './helpers/load-module.mjs';

const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  jsx: { runtime: 'automatic' },
  fsCache: false,
});
const structures = await j.import('../lib/design/structures.ts');
const metrics = await j.import('../lib/taste/metrics.ts');
const profile = await j.import('../lib/design/profile.ts');
const { grammarDirection, structureGrammar, laneIssues, VIBE_LANE } =
  await j.import('../lib/design/vibes.ts');
const { blockSchemas, catalogForPrompt } = await j.import(
  '../lib/blocks/registry.ts',
);
const { SignatureComposition } = await j.import('../lib/blocks/components.tsx');
const { scenePlan } = await j.import('../lib/images/scene-plan.ts');
const { expectedRatio } = await j.import('../lib/images/ratios.ts');
const { lintSite } = await j.import('../lib/taste/site.ts');
const { publicationFinding } = await j.import(
  '../lib/sites/publication-policy.ts',
);

const photo = (index) => `https://assets.test/signature-${index}.webp`;
const legacyStructures = Object.values(structures.SITE_STRUCTURES).filter(
  (structure) => structure.signatureLayout,
);
const commercialV8Structures = structures.COMMERCIAL_V8_STRUCTURE_KEYS.map(
  (key) => structures.SITE_STRUCTURES[key],
);

function signatureProps(layout, variant = 0) {
  const items = [
    {
      role: 'focus',
      label: 'Ponto de partida',
      title: 'A necessidade que orienta a escolha',
      body: 'Uma leitura concreta do contexto organiza a decisão e evita atalhos genéricos.',
      image: photo(1),
      imageAlt: 'Cena principal do contexto do cliente',
    },
    {
      role: 'support',
      label: 'Relação',
      title: 'As opções que fazem sentido juntas',
      body: 'O apoio conecta aplicação, detalhe e consequência numa sequência fácil de percorrer.',
      image: photo(2),
      imageAlt: 'Detalhe de apoio ligado ao assunto',
    },
    {
      role: 'detail',
      label: 'Critério',
      title: 'O detalhe que muda o resultado',
      body: 'O conteúdo explica por que este aspecto merece atenção antes do próximo passo.',
    },
    {
      role: 'action',
      label: 'Próximo passo',
      title: 'Uma ação coerente com a jornada',
      body: 'A chamada conclui a composição sem interromper a leitura ou inventar urgência.',
      cta: { label: 'Entender o processo', href: '/processo' },
    },
  ];
  if (variant === 1) items.unshift(items.splice(1, 1)[0]);
  return {
    layout,
    eyebrow: 'Composição própria',
    title: 'Uma leitura criada a partir deste contexto',
    body: 'A estrutura é controlada, enquanto os papéis, as cenas e a ordem nascem do assunto do cliente.',
    items,
  };
}

function designFor(structure) {
  const dark = structure.vibe === 'moderno';
  const lane = VIBE_LANE[structure.vibe];
  return {
    version: structure.signatureLayout ? 5 : 8,
    structure: structure.key,
    structureRationale:
      'Esta jornada corresponde ao conteúdo disponível e ao objetivo principal do cliente.',
    concept: 'Uma direção concreta construída para o assunto do negócio',
    signatureElement: 'Composição que relaciona cenas e critérios da escolha',
    displayFont: lane.axes.displayFont[0],
    bodyFont: lane.axes.bodyFont[0],
    heroComposition: structure.openings[0].split(':')[1],
    navigation: lane.axes.navigation[0],
    rhythm: lane.axes.rhythm[0],
    imageTreatment: lane.axes.imageTreatment[0],
    surfaceStyle: lane.axes.surfaceStyle[0],
    motif: lane.axes.motif[0],
    radius: lane.radius[0],
    ink: dark ? '#f5f6f8' : '#171717',
    paper: dark ? '#0b0c0e' : '#ffffff',
    surface: dark ? '#15171b' : '#f5f3ef',
    variance: lane.dials.variance[0],
    motion: lane.dials.motion[0],
    density: lane.dials.density[0],
    signature: `fixture-${structure.key}`,
    definedAt: '2026-09-12T00:00:00.000Z',
  };
}

function commercialV8Props(type, layout, index = 0) {
  switch (type) {
    case 'nav.bar':
      return {
        layout,
        logoText: 'Comércio local',
        links: [
          { label: 'Setores', href: '#categorias' },
          { label: 'História', href: '#historia' },
          { label: 'Unidades', href: '#onde-estamos' },
        ],
        cta: { label: 'Fale conosco', href: '#contato' },
      };
    case 'hero.split':
      return {
        layout,
        headline: 'Tudo o que você procura, perto de você',
        subtext: 'Conheça o comércio, as categorias e as formas de contato.',
        cta: { label: 'Ver categorias', href: '#categorias' },
        image: photo(10),
        imageAlt: 'Fachada real do comércio com o logo visível no letreiro',
      };
    case 'editorial.text':
      return {
        layout,
        title: 'Uma história construída perto das pessoas',
        body: 'Este texto institucional apresenta a origem do comércio e a relação que ele mantém com a comunidade.\n\nA trajetória é contada com fatos simples e linguagem direta.',
      };
    case 'feature.bento':
      return {
        anchor: 'categorias',
        layout,
        title: 'Encontre por categoria',
        items: [1, 2, 3, 4, 5, 6].map((item) => ({
          title: `Categoria ${item}`,
          body: `Uma descrição curta e útil da categoria ${item}.`,
          image: photo(10 + item),
          imageAlt: `Produtos da categoria ${item}`,
        })),
      };
    case 'social.follow':
      return {
        layout,
        eyebrow: 'Redes sociais',
        title: 'Acompanhe as novidades',
        body: 'Veja novidades e informações nos perfis oficiais cadastrados.',
        images: [11, 12, 13].map((item) => ({
          src: photo(item),
          alt: `Cena ${item - 10} do comércio`,
        })),
      };
    case 'media.image':
      return {
        layout,
        src: photo(20 + index),
        alt: 'Vista ampla e detalhada do ambiente do comércio',
        ...(layout === 'immersive'
          ? {}
          : { caption: 'Um espaço feito para receber bem todos os dias.' }),
      };
    case 'cta.band':
      return {
        layout,
        title:
          layout === 'band'
            ? 'Ofertas para aproveitar todos os dias'
            : layout === 'split'
              ? 'Trabalhe com a gente'
              : 'Quer falar com a nossa equipe?',
        body: 'Informação direta e útil para orientar o próximo passo.',
        cta: { label: 'Saiba mais', href: '#contato' },
        ...(layout === 'split'
          ? {
              image: photo(20 + index),
              imageAlt: 'Equipe trabalhando no ambiente do comércio',
            }
          : {}),
      };
    case 'media.gallery':
      return {
        layout,
        title: 'Nosso dia a dia',
        images: [11, 12, 13, 14, 15, 16].map((item) => ({
          src: photo(item),
          alt: `Cena ${item - 10} do comércio`,
        })),
      };
    case 'form.lead':
      return {
        layout,
        title: 'Fale com a nossa equipe',
        body: 'Envie sua mensagem e responderemos pelos canais cadastrados.',
        fields: [
          { name: 'nome', label: 'Nome', type: 'text', required: true },
          { name: 'email', label: 'E-mail', type: 'email', required: true },
        ],
        submitLabel: 'Enviar mensagem',
        redirectTo: '/obrigado',
      };
    case 'media.map':
      return {
        layout,
        title: 'Onde estamos',
        address: 'Rua Comercial, 100, Centro',
        query: 'Rua Comercial, 100, Centro',
      };
    case 'footer.compact':
      return {
        layout,
        logoText: 'Comércio local',
        tagline: 'Informação simples e contato direto.',
        links: [],
        legal: 'Todos os direitos reservados.',
      };
    default:
      throw new Error(`Bloco v8 inesperado: ${type}`);
  }
}

function blockFromMark(mark, index, variant = 0) {
  const separator = mark.indexOf(':');
  const type = mark.slice(0, separator);
  const layout = mark.slice(separator + 1);
  return {
    id: `block-${index}`,
    type,
    props:
      type === 'signature.composition'
        ? blockSchemas[type].parse(signatureProps(layout, variant))
        : type in blockSchemas &&
            [
              'hero.split',
              'nav.bar',
              'editorial.text',
              'feature.bento',
              'cta.band',
              'social.follow',
              'media.image',
              'media.gallery',
              'form.lead',
              'media.map',
              'footer.compact',
            ].includes(type)
          ? blockSchemas[type].parse(commercialV8Props(type, layout, index))
          : { layout },
  };
}

function homeFor(structure, variant = 0) {
  return {
    slug: '',
    type: 'page',
    title: structure.label,
    seo: {
      title: `${structure.label} para uma jornada específica`,
      description: 'Uma página de teste para validar a estrutura escolhida.',
    },
    meta: {
      inbound: { stage: 'conversion', intent: structure.intent },
    },
    blocks: [
      ...(!structure.signatureLayout
        ? [blockFromMark('nav.bar:bar', -1, variant)]
        : []),
      ...structure.sequence.map((mark, index) =>
        blockFromMark(mark, index, variant),
      ),
      ...(structure.footer
        ? [blockFromMark(structure.footer, 90, variant)]
        : []),
    ],
  };
}

function imagesFor(structure) {
  if (!structure.signatureLayout) {
    return [10, 11, 12, 13, 14, 15, 16, 25, 27, 28].map((seq) => ({
      id: `image-${seq}`,
      seq,
      kind: 'foto',
      referenceUrls: [],
      batchId: 'commercial-v8-fixture',
      requestText: `Cena comercial ${seq}`,
      targetBlock:
        seq === 10
          ? 'hero.brand'
          : [25, 27].includes(seq)
            ? 'media.image'
            : seq === 28
              ? 'cta.band'
              : 'feature.bento',
      ratio: seq >= 11 && seq <= 16 ? '4:3' : '16:9',
      model: seq === 10 ? 'current-site-import' : 'openai/gpt-image-2',
      url: photo(seq),
      blobPath:
        seq === 10
          ? `tenants/fixture/current-site/00000000-0000-4000-8000-000000000000/${'a'.repeat(64)}.webp`
          : `tenants/fixture/gerado/commercial-${seq}.webp`,
      status: 'disponivel',
      score: null,
      critique: {},
      alt:
        seq === 10
          ? 'Fachada real do comércio com o logo visível no letreiro'
          : null,
      description:
        seq === 10
          ? 'Foto oficial da fachada e entrada da loja com a marca no letreiro.'
          : null,
      createdAt: '2026-09-17T00:00:00.000Z',
    }));
  }
  return [1, 2].map((seq) => ({
    id: `image-${seq}`,
    seq,
    kind: 'foto',
    referenceUrls: [],
    batchId: 'structure-fixture',
    requestText: `Cena autoral ${seq}`,
    targetBlock: 'signature.composition',
    ratio: structure.signatureRatio,
    model: 'openai/gpt-image-2',
    url: photo(seq),
    blobPath: `tenants/fixture/gerado/structure-${seq}.webp`,
    status: 'disponivel',
    score: null,
    critique: {},
    alt: null,
    description: null,
    createdAt: '2026-09-12T00:00:00.000Z',
  }));
}

await test('a Comercial tem uma estrutura fixa e as demais vibes têm três', () => {
  assert.equal(structures.STRUCTURE_KEYS.length, 15);
  assert.equal(new Set(structures.STRUCTURE_KEYS).size, 15);
  assert.equal(structures.REFERENCE_STRUCTURE_KEYS.length, 12);
  assert.equal(structures.COMMERCIAL_V8_STRUCTURE_KEYS.length, 1);
  assert.equal(new Set(structures.SIGNATURE_LAYOUTS).size, 12);
  for (const [vibe, choices] of Object.entries(structures.STRUCTURES_BY_VIBE)) {
    assert.equal(choices.length, vibe === 'comercial' ? 1 : 3, vibe);
    if (vibe !== 'comercial') {
      assert.equal(
        new Set(choices.map((choice) => choice.signatureLayout)).size,
        3,
      );
      assert.equal(
        new Set(choices.map((choice) => choice.sequence.join('>'))).size,
        3,
      );
    } else {
      assert.equal(choices[0].key, 'comercial-marca');
      assert.equal(choices[0].footer, 'footer.compact:split');
    }
    for (const choice of choices)
      for (const mark of choice.sequence) {
        const [type, layout] = mark.split(':');
        assert.ok(blockSchemas[type], `${choice.key}: ${mark}`);
        const layoutSchema = blockSchemas[type].shape.layout;
        const options =
          layoutSchema?.def?.innerType?.options ?? layoutSchema?.options;
        assert.ok(options?.includes(layout), `${choice.key}: ${mark}`);
      }
    for (const choice of choices)
      for (const expansion of choice.expansions ?? []) {
        const [type, layout] = expansion.signature.split(':');
        assert.ok(blockSchemas[type], `${choice.key}: ${expansion.signature}`);
        const layoutSchema = blockSchemas[type].shape.layout;
        const options =
          layoutSchema?.def?.innerType?.options ?? layoutSchema?.options;
        assert.ok(
          options?.includes(layout),
          `${choice.key}: ${expansion.signature}`,
        );
      }
  }
});

await test('perfil v5 persiste estrutura e a gramática resolve somente a escolhida', () => {
  for (const structure of legacyStructures) {
    const design = designFor(structure);
    const grammar = structureGrammar(structure.vibe, design);
    assert.equal(grammar.structure?.key, structure.key);
    assert.deepEqual(grammar.openings, structure.openings);
    assert.deepEqual(grammar.protagonists, structure.protagonists);
    if (structure.vibe === 'comercial')
      assert.match(
        laneIssues(structure.vibe, design).join(' '),
        /Comercial v8/,
      );
    else assert.deepEqual(laneIssues(structure.vibe, design), []);
  }
  const wrong = structures.SITE_STRUCTURES['moderno-sistema'];
  assert.match(
    laneIssues('comercial', designFor(wrong)).join(' '),
    /Comercial v8/,
  );

  const input = profile.designProfileInputSchema.parse({
    ...designFor(wrong),
    brief: {
      audience: 'Pessoas que precisam organizar uma decisão importante',
      offer: 'Orientação especializada para uma escolha fundamentada',
      goal: 'Iniciar uma conversa com contexto suficiente',
      personality: ['clara', 'precisa'],
      evidence: ['Processo próprio documentado'],
    },
  });
  const completed = profile.completeDesignProfile(input);
  assert.equal(completed.version, 5);
  assert.equal(completed.structure, wrong.key);
  assert.equal(profile.isDesignProfile(completed), true);
  assert.equal(
    profile.isDesignProfile({ ...completed, structureRationale: undefined }),
    false,
  );
});

await test('perfil v8 nasce somente da estrutura fixa da Comercial', () => {
  for (const structure of commercialV8Structures) {
    const design = designFor(structure);
    const grammar = structureGrammar('comercial', design);
    assert.equal(grammar.structure?.key, structure.key);
    assert.deepEqual(grammar.openings, structure.openings);
    assert.deepEqual(laneIssues('comercial', design), []);
    const input = profile.designProfileInputSchema.parse({
      ...design,
      brief: {
        audience: 'Pessoas que compram e se relacionam com este comércio',
        offer: 'Categorias e atendimento informados pelo próprio comércio',
        goal: 'Apresentar o negócio e facilitar um contato direto',
        personality: ['simples', 'acolhedora'],
        evidence: ['O comércio confirmou sua história e seus contatos.'],
      },
    });
    const completed = profile.completeDesignProfile(input);
    assert.equal(completed.version, 8);
    assert.equal(profile.isDesignProfile(completed), true);
  }
  assert.match(
    laneIssues(
      'moderno',
      designFor(structures.SITE_STRUCTURES['comercial-marca']),
    ).join(' '),
    /não pertence à vibe Moderno|não é uma estrutura disponível/,
  );
});

await test('plano de cenas usa a assinatura e a proporção da estrutura', () => {
  for (const structure of legacyStructures) {
    const scenes = scenePlan(designFor(structure), 3, structure.vibe);
    const signatureScenes = scenes.filter(
      (scene) => scene.targetBlock === 'signature.composition',
    );
    assert.equal(signatureScenes.length, 2, structure.key);
    assert.ok(
      signatureScenes.every(
        (scene) => scene.ratio === structure.signatureRatio,
      ),
      structure.key,
    );
    assert.equal(
      expectedRatio('signature.composition', structure.signatureLayout),
      structure.signatureRatio,
      structure.key,
    );
  }
});

await test('plano v8 cobre fachada, seis setores, imagem imersiva e carreira', () => {
  for (const structure of commercialV8Structures) {
    const scenes = scenePlan(designFor(structure), 3, 'comercial');
    const categories = scenes.filter(
      (scene) => scene.targetBlock === 'feature.bento',
    );
    assert.equal(categories.length, 6, structure.key);
    assert.equal(
      scenes.filter((scene) => scene.targetBlock === 'media.image').length,
      1,
      structure.key,
    );
    assert.equal(
      scenes.some((scene) => scene.targetBlock === 'hero.info'),
      false,
      structure.key,
    );
    assert.equal(scenes.length, 9);
    assert.equal(scenes[0].targetBlock, 'hero.brand');
    assert.equal(
      scenes.filter((scene) => scene.targetBlock === 'cta.band').length,
      1,
    );
  }
});

await test('as doze estruturas atravessam o pre-flight com composição e cenas próprias', () => {
  for (const structure of legacyStructures) {
    const findings = metrics.structuralFindings(
      [homeFor(structure)],
      imagesFor(structure),
      { vibe: structure.vibe, design: designFor(structure) },
    );
    const rules = findings.map((finding) => finding.rule);
    assert.equal(
      rules.includes('estrutura-v5-incompleta'),
      false,
      structure.key,
    );
    assert.equal(
      rules.includes('composicao-autoral-obrigatoria'),
      false,
      structure.key,
    );
    assert.equal(
      rules.includes('protagonista-fora-da-vibe'),
      false,
      structure.key,
    );
    assert.equal(rules.includes('abertura-fora-da-vibe'), false, structure.key);
    assert.equal(
      rules.includes('fechamento-fora-da-vibe'),
      false,
      structure.key,
    );
  }
});

await test('a estrutura fixa v8 atravessa o pre-flight com o contrato completo', () => {
  for (const structure of commercialV8Structures) {
    const findings = metrics.structuralFindings(
      [homeFor(structure)],
      imagesFor(structure),
      { vibe: 'comercial', design: designFor(structure) },
    );
    const rules = findings
      .filter((finding) => finding.level === 'error')
      .map((finding) => finding.rule);
    assert.equal(
      rules.includes('estrutura-v5-incompleta'),
      false,
      structure.key,
    );
    assert.equal(
      rules.includes('comercial-v8-estrutura'),
      false,
      structure.key,
    );
    assert.equal(rules.includes('comercial-v8-rodape'), false, structure.key);
    assert.equal(
      rules.includes('comercial-v8-categorias'),
      false,
      structure.key,
    );
    assert.equal(rules.includes('home-protagonista'), false, structure.key);
  }
});

await test('Comercial exige a ligação institucional entre hero e setores, sem aceitar texto simples', () => {
  const structure = structures.SITE_STRUCTURES['comercial-marca'];
  assert.deepEqual(structure.sequence.slice(0, 3), [
    'hero.split:brand',
    'editorial.text:bridge',
    'feature.bento:gallery',
  ]);
  for (const layout of ['lead', 'narrow', 'split']) {
    const page = homeFor(structure);
    page.blocks.find((block) => block.type === 'editorial.text').props.layout =
      layout;
    const rules = metrics
      .structuralFindings([page], imagesFor(structure), {
        vibe: 'comercial',
        design: designFor(structure),
      })
      .map((finding) => finding.rule);
    assert.ok(rules.includes('comercial-v8-estrutura'), layout);
  }
});

await test('a Comercial v8 recusa hero sem descrição da fachada', () => {
  const structure = structures.SITE_STRUCTURES['comercial-marca'];
  const page = homeFor(structure);
  const hero = page.blocks.find((block) => block.type === 'hero.split');
  delete hero.props.imageAlt;
  const rules = metrics
    .structuralFindings([page], imagesFor(structure), {
      vibe: 'comercial',
      design: designFor(structure),
    })
    .map((finding) => finding.rule);
  assert.ok(rules.includes('comercial-v8-hero-imagem'));
});

await test('pre-flight recusa sequência fora de ordem e ausência da assinatura', () => {
  const structure = structures.SITE_STRUCTURES['moderno-sistema'];
  const page = homeFor(structure);
  page.blocks.reverse();
  let rules = metrics
    .structuralFindings([page], imagesFor(structure), {
      vibe: structure.vibe,
      design: designFor(structure),
    })
    .map((finding) => finding.rule);
  assert.ok(rules.includes('estrutura-v5-incompleta'));

  page.blocks = homeFor(structure).blocks.filter(
    (block) => block.type !== 'signature.composition',
  );
  rules = metrics
    .structuralFindings([page], imagesFor(structure), {
      vibe: structure.vibe,
      design: designFor(structure),
    })
    .map((finding) => finding.rule);
  assert.ok(rules.includes('composicao-autoral-obrigatoria'));
  assert.ok(rules.includes('protagonista-fora-da-vibe'));
});

await test('composição exige foco único, apoio e alt, e renderiza as quatro famílias semânticas', () => {
  const paths = new Set(['decision-path', 'campaign-sequence', 'story-orbit']);
  const lenses = new Set(['service-lens', 'detail-lens', 'visual-selector']);
  const maps = new Set(['proof-route', 'system-map', 'material-table']);
  for (const structure of legacyStructures) {
    const parsed = blockSchemas['signature.composition'].parse(
      signatureProps(structure.signatureLayout),
    );
    const html = renderToStaticMarkup(
      createElement(SignatureComposition, {
        ...parsed,
        vibe: structure.vibe,
      }),
    );
    assert.match(
      html,
      new RegExp(`site-signature-${structure.signatureLayout}`),
    );
    const semanticClass = paths.has(structure.signatureLayout)
      ? '<ol'
      : lenses.has(structure.signatureLayout)
        ? 'site-signature-lens'
        : maps.has(structure.signatureLayout)
          ? 'site-signature-map'
          : 'site-signature-editorial';
    assert.ok(html.includes(semanticClass), structure.key);
    assert.match(html, /data-role="focus"/);
    assert.match(html, /data-role="support"/);
  }

  const noFocus = signatureProps('decision-path');
  noFocus.items[0].role = 'support';
  assert.equal(
    blockSchemas['signature.composition'].safeParse(noFocus).success,
    false,
  );
  const noSupport = signatureProps('decision-path');
  noSupport.items[1].role = 'detail';
  assert.equal(
    blockSchemas['signature.composition'].safeParse(noSupport).success,
    false,
  );
  const noAlt = signatureProps('decision-path');
  delete noAlt.items[0].imageAlt;
  assert.equal(
    blockSchemas['signature.composition'].safeParse(noAlt).success,
    false,
  );
});

await test('a assinatura diferencia sites da mesma estrutura sem usar conteúdo do cliente', async () => {
  const structure = structures.SITE_STRUCTURES['comercial-atendimento'];
  const design = designFor(structure);
  const first = homeFor(structure, 0).blocks;
  const second = homeFor(structure, 1).blocks;
  const firstShape = metrics.uniquenessSilhouette(first, design);
  const secondShape = metrics.uniquenessSilhouette(second, design);
  assert.equal(
    firstShape.some((mark) => mark.includes('necessidade')),
    false,
  );
  assert.equal(metrics.orderedSilhouetteSimilarity(firstShape, firstShape), 1);
  assert.ok(
    metrics.orderedSilhouetteSimilarity(firstShape, secondShape) <
      metrics.SILHOUETTE_LIMIT,
  );
  const databaseShape = first.map((block) => ({
    ...block,
    props: {
      layout: block.props.layout,
      presentation: {
        tone: block.props.presentation?.tone,
        edge: block.props.presentation?.edge,
      },
      items: Array.isArray(block.props.items)
        ? block.props.items.map((item) => ({
            role: item.role,
            image: Object.hasOwn(item, 'image'),
            cta: Object.hasOwn(item, 'cta'),
          }))
        : [],
    },
  }));
  assert.deepEqual(
    metrics.uniquenessSilhouette(databaseShape, design),
    firstShape,
  );

  const uniqueness = await loadModule('lib/design/uniqueness.ts', {
    '../db': { db: () => async () => [{ blocks: second, design }] },
    '../taste/metrics': metrics,
    './profile': profile,
  });
  assert.equal(
    await uniqueness.compositionConflict('fixture', first, design),
    null,
  );
  const duplicate = await loadModule('lib/design/uniqueness.ts', {
    '../db': { db: () => async () => [{ blocks: first, design }] },
    '../taste/metrics': metrics,
    './profile': profile,
  });
  assert.equal(
    (await duplicate.compositionConflict('fixture', first, design)).similarity,
    1,
  );
});

await test('perfil v6 preserva a composição escolhida pela referência sem consultar unicidade', async () => {
  const structure = structures.SITE_STRUCTURES['artistico-revista'];
  const design = {
    ...designFor(structure),
    version: 6,
    referenceDirection: {
      primaryUrl: 'https://reference.test/',
      decisions: [
        'layout',
        'typography',
        'imagery',
        'rhythm',
        'surface',
        'mobile',
      ].map((aspect) => ({
        aspect,
        sourceUrl: 'https://reference.test/',
        observed: `Característica visual observada para ${aspect}.`,
        application: `Aplicação concreta da referência para ${aspect}.`,
      })),
      adaptations:
        'Preservar a marca, o conteúdo e a acessibilidade ao adaptar a referência.',
    },
  };
  const uniqueness = await loadModule('lib/design/uniqueness.ts', {
    '../db': {
      db: () => assert.fail('perfil v6 não deve consultar outros clientes'),
    },
    '../taste/metrics': metrics,
    './profile': profile,
  });
  assert.equal(
    await uniqueness.compositionConflict(
      'fixture',
      homeFor(structure).blocks,
      design,
    ),
    null,
  );
});

await test('catálogo da composição aponta somente o layout selecionado', () => {
  const structure = structures.SITE_STRUCTURES['artistico-galeria'];
  const catalog = catalogForPrompt({
    vibe: structure.vibe,
    design: designFor(structure),
  });
  assert.match(
    catalog,
    /signature\.composition · .*protagonista da home em signature\.composition:story-orbit/,
  );
  assert.match(catalog, /layout\(decision-path\|service-lens\|proof-route/);
});

await test('home comercial cresce de forma proporcional somente com camadas sustentadas', () => {
  const structure = structures.SITE_STRUCTURES['comercial-vitrine'];
  const minimal = metrics.briefDepth(
    { evidence: ['Atendimento confirmado.'] },
    2,
  );
  assert.equal(metrics.homeSectionFloor(structure, minimal), 5);
  assert.deepEqual(metrics.availableHomeExpansions(structure, minimal), []);
  const brief = {
    evidence: [
      'A operação atende 12 unidades em três estados.',
      'O processo reduziu em 35% o tempo de resposta confirmado.',
      'A equipe atua com marcas dos setores de energia e indústria.',
      'Há cobertura presencial nas cidades informadas pelo cliente.',
      'Depoimento: “A implantação organizou nossa rotina”, afirmou Ana Lima.',
      'Depoimento: “O resultado ficou visível no primeiro ciclo”, disse Rui Alves.',
      'A estrutura de atendimento funciona em horário comercial.',
      'O benefício confirmado é uma decisão com contexto centralizado.',
    ],
    intake: { story: 'Contexto operacional detalhado. '.repeat(70) },
    pagePlan: Array.from({ length: 5 }, (_, index) => ({ slug: `${index}` })),
  };
  const depth = metrics.briefDepth(brief, 6);
  assert.equal(depth.evidenceCount, 8);
  assert.equal(depth.numericEvidenceCount, 2);
  assert.ok(depth.storyLength > 1500);
  assert.equal(depth.pagePlanLength, 5);
  assert.equal(depth.photos, 6);
  assert.equal(metrics.homeSectionFloor(structure, depth), 7);
  assert.equal(metrics.homeWordFloor(7), 220);

  const confidence = structures.SITE_STRUCTURES['comercial-confianca'];
  const confidenceDepth = metrics.briefDepth(
    {
      evidence: [
        'Cliente Marca Norte confirmou a parceria.',
        'Cliente Marca Sul confirmou a parceria.',
        'Cliente Marca Leste confirmou a parceria.',
        'A cobertura inclui atendimento em horário comercial.',
      ],
    },
    8,
  );
  assert.deepEqual(
    metrics
      .availableHomeExpansions(confidence, confidenceDepth)
      .map((item) => item.signature),
    ['proof.strip:logos', 'feature.showcase:tabs', 'editorial.facts:ledger'],
  );
  assert.deepEqual(
    metrics
      .availableHomeExpansions(confidence, { ...confidenceDepth, photos: 7 })
      .map((item) => item.signature),
    ['proof.strip:logos', 'editorial.facts:ledger'],
  );

  const expansions = metrics.availableHomeExpansions(structure, depth);
  assert.deepEqual(
    expansions.map((item) => item.signature),
    [
      'proof.strip:numbers',
      'narrative.statement:split',
      'editorial.facts:ledger',
      'proof.testimonials:grid',
    ],
  );
  const shallow = homeFor(structure);
  let findings = metrics.structuralFindings(
    [shallow],
    imagesFor(structure),
    { vibe: structure.vibe, design: designFor(structure) },
    brief,
  );
  const shallowFinding = findings.find(
    (finding) => finding.rule === 'home-rasa',
  );
  assert.equal(shallowFinding.level, 'error');
  assert.match(shallowFinding.message, /5 seções/);
  assert.match(shallowFinding.message, /piso de 7 seções e 220 palavras/);
  assert.match(
    shallowFinding.message,
    /proof\.strip:numbers.*narrative\.statement:split/,
  );
  assert.equal(publicationFinding(shallowFinding).level, 'warn');

  const expanded = homeFor(structure);
  expanded.blocks.splice(1, 0, blockFromMark('proof.strip:numbers', 90));
  const explorer = expanded.blocks.findIndex(
    (block) => block.type === 'feature.explorer',
  );
  expanded.blocks.splice(
    explorer,
    0,
    blockFromMark('narrative.statement:split', 91),
  );
  findings = metrics.structuralFindings(
    [expanded],
    imagesFor(structure),
    { vibe: structure.vibe, design: designFor(structure) },
    brief,
  );
  assert.equal(
    findings.some((finding) => finding.rule === 'home-rasa'),
    false,
  );

  const misplaced = structuredClone(expanded);
  const statement = misplaced.blocks.findIndex(
    (block) => block.type === 'narrative.statement',
  );
  misplaced.blocks.splice(1, 0, misplaced.blocks.splice(statement, 1)[0]);
  findings = metrics.structuralFindings(
    [misplaced],
    imagesFor(structure),
    { vibe: structure.vibe, design: designFor(structure) },
    brief,
  );
  assert.equal(
    findings.some((finding) => finding.rule === 'home-rasa'),
    true,
  );

  const wordFinding = lintSite(
    [
      expanded,
      { ...expanded, slug: 'solucoes', title: 'Soluções' },
      { ...expanded, slug: 'contato', title: 'Contato' },
    ],
    imagesFor(structure),
    'draft',
    { vibe: structure.vibe, design: designFor(structure) },
    brief,
  ).find(
    (finding) => finding.page === '/' && finding.rule === 'inbound-conteudo',
  );
  assert.match(wordFinding.message, /menos de 220 palavras/);

  const direction = grammarDirection('comercial', designFor(structure), false, {
    sectionFloor: 7,
    wordFloor: 220,
    expansions,
  });
  assert.match(direction, /no mínimo 7 seções e 220 palavras/);
  const catalog = catalogForPrompt({
    vibe: 'comercial',
    design: designFor(structure),
    expansions: expansions.map((item) => item.signature),
  });
  assert.match(
    catalog,
    /proof\.strip.*aprofundamento da home em proof\.strip:numbers/s,
  );

  const scenes = scenePlan(designFor(structure), 3, 'comercial', brief);
  assert.equal(scenes.length, 6);
  assert.deepEqual(scenes.at(-1), {
    role: 'apoio',
    targetBlock: 'narrative.split',
    ratio: '5:6',
    page: '',
    hint: 'Cena vertical de apoio para aprofundar a narrativa da home comercial, sem simular prova ou cliente.',
  });
});

await test('mover o focus no JSON não diferencia mapas com o mesmo HTML', async () => {
  for (const key of [
    'comercial-confianca',
    'moderno-sistema',
    'artistico-atelier',
  ]) {
    const structure = structures.SITE_STRUCTURES[key];
    const design = designFor(structure);
    const original = homeFor(structure);
    const signature = original.blocks.find(
      (block) => block.type === 'signature.composition',
    );
    const html = renderToStaticMarkup(
      createElement(SignatureComposition, signature.props),
    );
    const shape = metrics.uniquenessSilhouette(original.blocks, design);
    for (
      let position = 1;
      position < signature.props.items.length;
      position++
    ) {
      const reordered = structuredClone(original);
      const candidate = reordered.blocks.find(
        (block) => block.type === 'signature.composition',
      );
      const [focus] = candidate.props.items.splice(0, 1);
      candidate.props.items.splice(position, 0, focus);
      assert.equal(
        renderToStaticMarkup(
          createElement(SignatureComposition, candidate.props),
        ),
        html,
        key,
      );
      assert.deepEqual(
        metrics.uniquenessSilhouette(reordered.blocks, design),
        shape,
        key,
      );
      const projected = reordered.blocks.map((block) => ({
        ...block,
        props: {
          layout: block.props.layout,
          items: block.props.items?.map((item) => ({
            role: item.role,
            image: Object.hasOwn(item, 'image'),
            cta: Object.hasOwn(item, 'cta'),
          })),
        },
      }));
      const uniqueness = await loadModule('lib/design/uniqueness.ts', {
        '../db': { db: () => async () => [{ blocks: projected, design }] },
        '../taste/metrics': metrics,
        './profile': profile,
      });
      assert.equal(
        (
          await uniqueness.compositionConflict(
            'fixture',
            original.blocks,
            design,
          )
        )?.similarity,
        1,
        key,
      );
    }
    const changed = structuredClone(original);
    const items = changed.blocks.find(
      (block) => block.type === 'signature.composition',
    ).props.items;
    [items[1], items[2]] = [items[2], items[1]];
    assert.notEqual(
      renderToStaticMarkup(
        createElement(
          SignatureComposition,
          changed.blocks.find((block) => block.type === 'signature.composition')
            .props,
        ),
      ),
      html,
      key,
    );
    assert.ok(
      metrics.orderedSilhouetteSimilarity(
        shape,
        metrics.uniquenessSilhouette(changed.blocks, design),
      ) < metrics.SILHOUETTE_LIMIT,
      key,
    );
  }
});
