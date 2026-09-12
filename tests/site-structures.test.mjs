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
const { structureGrammar, laneIssues, VIBE_LANE } = await j.import(
  '../lib/design/vibes.ts',
);
const { blockSchemas, catalogForPrompt } = await j.import(
  '../lib/blocks/registry.ts',
);
const { SignatureComposition } = await j.import('../lib/blocks/components.tsx');
const { scenePlan } = await j.import('../lib/images/scene-plan.ts');
const { expectedRatio } = await j.import('../lib/images/ratios.ts');

const photo = (index) => `https://assets.test/signature-${index}.webp`;

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
    version: 5,
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
    blocks: structure.sequence.map((mark, index) =>
      blockFromMark(mark, index, variant),
    ),
  };
}

function imagesFor(structure) {
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

await test('cada vibe oferece três estruturas completas e distintas', () => {
  assert.equal(structures.STRUCTURE_KEYS.length, 12);
  assert.equal(new Set(structures.STRUCTURE_KEYS).size, 12);
  assert.equal(new Set(structures.SIGNATURE_LAYOUTS).size, 12);
  for (const [vibe, choices] of Object.entries(structures.STRUCTURES_BY_VIBE)) {
    assert.equal(choices.length, 3, vibe);
    assert.equal(
      new Set(choices.map((choice) => choice.signatureLayout)).size,
      3,
    );
    assert.equal(
      new Set(choices.map((choice) => choice.sequence.join('>'))).size,
      3,
    );
    for (const choice of choices)
      for (const mark of choice.sequence) {
        const [type, layout] = mark.split(':');
        assert.ok(blockSchemas[type], `${choice.key}: ${mark}`);
        const layoutSchema = blockSchemas[type].shape.layout;
        const options =
          layoutSchema?.def?.innerType?.options ?? layoutSchema?.options;
        assert.ok(options?.includes(layout), `${choice.key}: ${mark}`);
      }
  }
});

await test('perfil v5 persiste estrutura e a gramática resolve somente a escolhida', () => {
  for (const structure of Object.values(structures.SITE_STRUCTURES)) {
    const design = designFor(structure);
    const grammar = structureGrammar(structure.vibe, design);
    assert.equal(grammar.structure?.key, structure.key);
    assert.deepEqual(grammar.openings, structure.openings);
    assert.deepEqual(grammar.protagonists, structure.protagonists);
    assert.deepEqual(laneIssues(structure.vibe, design), []);
  }
  const wrong = structures.SITE_STRUCTURES['moderno-sistema'];
  assert.match(
    laneIssues('comercial', designFor(wrong)).join(' '),
    /não pertence à vibe Comercial/,
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

await test('plano de cenas usa a assinatura e a proporção da estrutura', () => {
  for (const structure of Object.values(structures.SITE_STRUCTURES)) {
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

await test('as doze estruturas atravessam o pre-flight com composição e cenas próprias', () => {
  for (const structure of Object.values(structures.SITE_STRUCTURES)) {
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
  for (const structure of Object.values(structures.SITE_STRUCTURES)) {
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
