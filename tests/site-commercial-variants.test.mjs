import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';

const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  jsx: { runtime: 'automatic' },
  fsCache: false,
});

const variants = await j.import('../lib/design/commercial-variants.ts');
const structures = await j.import('../lib/design/structures.ts');
const profile = await j.import('../lib/design/profile.ts');
const { structureGrammar } = await j.import('../lib/design/vibes.ts');
const { scenePlan, sceneRequestsMatchPlan } = await j.import(
  '../lib/images/scene-plan.ts',
);

const {
  COMMERCIAL_AREAS,
  COMMERCIAL_VARIANTS,
  commercialScenes,
  commercialSequence,
  commercialSignatureCount,
  commercialVariantsFor,
  resolveCommercialVariants,
} = variants;

/** A combinação publicada hoje: o primeiro item de cada área. */
const base = Object.fromEntries(
  COMMERCIAL_AREAS.map((area) => [area, COMMERCIAL_VARIANTS[area][0].key]),
);

await test('o sorteio é estável e independente por área', () => {
  const seed = '7b1d3c2a-0000-4000-8000-000000000001';
  assert.deepEqual(commercialVariantsFor(seed), commercialVariantsFor(seed));
  // Dois tenants não podem divergir só porque a primeira área divergiu: o hash
  // é refeito por área justamente para as escolhas não correlacionarem.
  const pares = new Set();
  for (let i = 0; i < 400; i++)
    pares.add(
      `${commercialVariantsFor(`t${i}`).abertura}|${commercialVariantsFor(`t${i}`).setores}`,
    );
  assert.equal(
    pares.size,
    4,
    `combinações abertura×setores: ${[...pares].join(' ')}`,
  );
});

await test('cada área com duas versões distribui as duas', () => {
  for (const area of COMMERCIAL_AREAS) {
    if (COMMERCIAL_VARIANTS[area].length < 2) continue;
    const contagem = new Map();
    for (let i = 0; i < 2000; i++) {
      const key = commercialVariantsFor(`tenant-${i}`)[area];
      contagem.set(key, (contagem.get(key) ?? 0) + 1);
    }
    for (const variant of COMMERCIAL_VARIANTS[area]) {
      const share = (contagem.get(variant.key) ?? 0) / 2000;
      assert.ok(
        share > 0.35 && share < 0.65,
        `${area}/${variant.key} saiu em ${(share * 100).toFixed(1)}% dos sorteios`,
      );
    }
  }
});

await test('o re-sorteio muda a combinação sem perder o determinismo', () => {
  const seed = 'e3a1';
  assert.deepEqual(
    commercialVariantsFor(seed, 3),
    commercialVariantsFor(seed, 3),
  );
  // Uma tentativa isolada pode repetir por acaso; o que precisa valer é a
  // sequência oferecer saídas para quem precisar fugir de uma colisão.
  const primeira = JSON.stringify(commercialVariantsFor(seed));
  const alternativas = new Set();
  for (let attempt = 1; attempt <= 8; attempt++)
    alternativas.add(JSON.stringify(commercialVariantsFor(seed, attempt)));
  alternativas.delete(primeira);
  assert.ok(alternativas.size >= 4, `só ${alternativas.size} alternativas`);
});

await test('perfil sem combinação renderiza a composição publicada', () => {
  const resolved = resolveCommercialVariants(undefined);
  assert.deepEqual(
    commercialSequence(resolved),
    [...structures.SITE_STRUCTURES['comercial-marca'].sequence],
    'a sequência base precisa continuar idêntica à da estrutura',
  );
  assert.equal(
    variants.commercialFooter(resolved),
    structures.SITE_STRUCTURES['comercial-marca'].footer,
  );
  // Uma chave desconhecida — variação removida numa versão futura — também cai
  // na base, em vez de derrubar a leitura de um perfil já gravado.
  assert.deepEqual(
    commercialSequence(resolveCommercialVariants({ setores: 'inexistente' })),
    commercialSequence(resolved),
  );
});

await test('a gramática entrega a sequência da combinação do tenant', () => {
  const design = {
    version: 8,
    structure: 'comercial-marca',
    heroComposition: 'brand',
    commercialVariants: { ...base, abertura: 'abertura-painel' },
  };
  const grammar = structureGrammar('comercial', design);
  assert.equal(grammar.structure.sequence[0], 'hero.split:brand-frame');
  assert.deepEqual(grammar.openings, ['hero.split:brand-frame']);
  // Sem a combinação, a mesma chamada precisa devolver o que está no ar.
  const publicado = structureGrammar('comercial', {
    version: 8,
    structure: 'comercial-marca',
    heroComposition: 'brand',
  });
  assert.deepEqual(
    [...publicado.structure.sequence],
    [...structures.SITE_STRUCTURES['comercial-marca'].sequence],
  );
});

await test('o plano de cenas acompanha o contrato de cada variação', () => {
  const comBase = scenePlan(
    { version: 8, structure: 'comercial-marca', heroComposition: 'brand' },
    3,
    'comercial',
  );
  assert.equal(comBase.length, 9);
  assert.equal(comBase[0].targetBlock, 'hero.brand');
  assert.equal(
    comBase.filter((scene) => scene.targetBlock === 'feature.bento').length,
    6,
  );
  assert.ok(comBase.every((scene) => scene.estilo === undefined));

  const comLista = scenePlan(
    {
      version: 8,
      structure: 'comercial-marca',
      heroComposition: 'brand',
      commercialVariants: { ...base, setores: 'setores-lista' },
    },
    3,
    'comercial',
  );
  const setores = comLista.filter(
    (scene) => scene.targetBlock === 'feature.bento',
  );
  assert.equal(setores.length, 5);
  assert.ok(setores.every((scene) => scene.estilo === 'gravura'));
  assert.ok(setores.every((scene) => scene.transparent === true));
  // A abertura do hero continua pedindo fotografia real da fachada.
  assert.equal(comLista[0].estilo, undefined);
});

await test('uma vaga só pede uma proporção por bloco de destino', () => {
  // prepare_site_images impõe a proporção do primeiro slot de cada
  // targetBlock a todas as cenas dele: misturar proporções num mesmo bloco
  // recusaria o lote sem o agente ter como corrigir.
  for (const area of COMMERCIAL_AREAS)
    for (const variant of COMMERCIAL_VARIANTS[area]) {
      const porBloco = new Map();
      for (const slot of variant.scenes ?? []) {
        const anterior = porBloco.get(slot.targetBlock);
        assert.ok(
          anterior === undefined || anterior === slot.ratio,
          `${area}/${variant.key} pede ${slot.targetBlock} em duas proporções`,
        );
        porBloco.set(slot.targetBlock, slot.ratio);
      }
    }
});

await test('o plano resolvido casa com os pedidos de imagem do agente', () => {
  const design = {
    version: 8,
    structure: 'comercial-marca',
    heroComposition: 'brand',
    commercialVariants: { ...base, setores: 'setores-lista' },
  };
  const plan = scenePlan(design, 3, 'comercial');
  const pedidos = plan.map((scene) => ({
    request: 'Uma cena concreta e específica deste comércio para esta vaga.',
    role: scene.role,
    targetBlock: scene.targetBlock,
  }));
  assert.ok(sceneRequestsMatchPlan(plan, pedidos));
  assert.ok(!sceneRequestsMatchPlan(plan, pedidos.slice(1)));
});

await test('a contagem de faixas imersivas segue a combinação', () => {
  assert.equal(
    commercialSignatureCount(
      resolveCommercialVariants(base),
      'media.image:immersive',
    ),
    2,
  );
  assert.equal(
    commercialSignatureCount(
      resolveCommercialVariants({ ...base, 'faixa-abertura': 'faixa-gravura' }),
      'media.image:immersive',
    ),
    1,
  );
});

await test('a assinatura do perfil enxerga a combinação', () => {
  const entrada = {
    concept: 'O comércio apresentado por cenas simples e informação direta',
    signatureElement: 'Fotografia ampla entre blocos de leitura calma',
    structure: 'comercial-marca',
    structureRationale: 'A jornada completa da vibe comercial.',
    displayFont: 'humanist',
    bodyFont: 'source',
    heroComposition: 'brand',
    navigation: 'bar',
    rhythm: 'alternating',
    imageTreatment: 'full-bleed',
    surfaceStyle: 'flat',
    motif: 'none',
  };
  const semSemente = profile.completeDesignProfile(entrada, undefined);
  assert.equal(semSemente.commercialVariants, undefined);
  const a = profile.completeDesignProfile(entrada, undefined, 'tenant-a');
  const b = profile.completeDesignProfile(entrada, undefined, 'tenant-b');
  assert.ok(a.commercialVariants);
  // Perfil legado mantém a assinatura de antes; com combinação, ela distingue.
  assert.ok(!semSemente.signature.includes('+'));
  assert.notEqual(a.signature, semSemente.signature);
  if (
    JSON.stringify(a.commercialVariants) !==
    JSON.stringify(b.commercialVariants)
  )
    assert.notEqual(a.signature, b.signature);
});

await test('toda variação declara assinatura viável e rótulo próprio', () => {
  const vistos = new Set();
  for (const area of COMMERCIAL_AREAS)
    for (const variant of COMMERCIAL_VARIANTS[area]) {
      assert.ok(!vistos.has(variant.key), `chave repetida: ${variant.key}`);
      vistos.add(variant.key);
      assert.match(variant.signature, /^[a-z]+\.[a-zA-Z]+:[a-z-]+$/);
      assert.ok(variant.intent.length > 20, `${variant.key} sem intenção útil`);
    }
});

await test('o texto da composição informa contagens e natureza da imagem', () => {
  const texto = variants.commercialCompositionText(
    resolveCommercialVariants({ ...base, setores: 'setores-lista' }),
  );
  assert.match(texto, /feature\.bento:stack/);
  assert.match(texto, /exatamente 5 itens/);
  assert.match(texto, /5 gravuras 4:3/);
  const baseTexto = variants.commercialCompositionText(
    resolveCommercialVariants(base),
  );
  assert.match(baseTexto, /exatamente 6 itens/);
  assert.match(baseTexto, /6 fotos 4:3/);
});

await test('commercialScenes numera as vagas repetidas', () => {
  const cenas = commercialScenes(resolveCommercialVariants(base));
  const setores = cenas.filter((c) => c.targetBlock === 'feature.bento');
  assert.equal(setores.length, 6);
  assert.match(setores[0].hint, /item 1 da grade/);
  assert.match(setores[5].hint, /item 6 da grade/);
  assert.ok(cenas.every((c) => !c.hint.includes('{i}')));
});
