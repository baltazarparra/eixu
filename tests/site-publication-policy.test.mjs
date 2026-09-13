import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';

const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
const { publicationFinding } = await j.import(
  '../lib/sites/publication-policy.ts',
);
const { isDirectPublicationRequest, isPublicationRepairRequest } =
  await j.import('../lib/sites/publication-request.ts');
const { repairPublicationProof } = await j.import(
  '../lib/sites/proof-repair.ts',
);
const { landingFixture } = await j.import('./helpers/landing-data.ts');
const { lintPage } = await j.import('../lib/taste/lint.ts');
const { landingClaims, claimSupported } = await j.import(
  '../lib/taste/landing.ts',
);
const { confirmedEvidence } = await j.import('../lib/ai/evidence.ts');
const { workspaceState } = await j.import('../lib/admin/state.ts');

await test('qualidade editorial não veta o operador e regras técnicas continuam exigentes', () => {
  for (const rule of [
    'landing-prova',
    'landing-preco',
    'home-protagonista',
    'hero-headline',
    'composicao-duplicada',
  ]) {
    const finding = {
      level: 'error',
      rule,
      message: 'Revisar',
      blockId: 'b',
      page: '/',
    };
    assert.equal(publicationFinding(finding).level, 'warn');
    assert.equal(finding.level, 'error', 'não altera o lint usado na geração');
  }
  for (const rule of [
    'props-invalidas',
    'bloco-desconhecido',
    'slug-duplicado',
    'link-interno',
    'texto-contraste',
    'regra-nova',
  ])
    assert.equal(
      publicationFinding({ level: 'error', rule, message: 'Corrigir' }).level,
      'error',
    );
});

await test('só comandos diretos abrem o atalho de publicação', () => {
  for (const text of [
    'publicar, eu autorizo',
    'Publique o site.',
    'Pode publicar agora!',
    'Eu autorizo, publique o projeto',
    'Por favor publique todas as páginas',
  ])
    assert.ok(isDirectPublicationRequest(text), text);
  for (const text of [
    'não publicar',
    'não publique o site',
    'pode publicar?',
    'quando vai publicar?',
    '"publicar, eu autorizo"',
    'publique /contato',
    'publique a página atual',
    'corrija o título e publique',
    '2 pendências para publicar',
    'O agente disse: publicar',
    'publicar\neu autorizo',
  ])
    assert.ok(!isDirectPublicationRequest(text), text);
  assert.ok(
    isPublicationRepairRequest(
      'resolva: 2 pendências para publicar\n/O selo do hero...',
    ),
  );
  assert.ok(isPublicationRepairRequest('Resolva as pendências de publicação.'));
  assert.ok(
    isPublicationRepairRequest(
      'resolva: 2 pendências para publicar /O selo não está sustentado pela evidência informada.',
    ),
  );
  assert.ok(
    !isPublicationRepairRequest(
      'Resolva as pendências.\nNão remova nenhum texto.',
    ),
  );
  assert.ok(
    !isPublicationRepairRequest(
      'Resolva as pendências.\nPreserve todo o conteúdo.',
    ),
  );
  for (const text of [
    'Corrija apenas a pendência da imagem #8.',
    'Resolva a pendência de publicação na página /contato.',
    'Resolva as pendências.\nSó a imagem #8.',
    'Corrija as pendências do rodapé.',
  ])
    assert.ok(!isPublicationRepairRequest(text), text);
  for (const text of [
    '2 pendências para publicar\nResolva isso',
    'Não resolva as pendências',
    'Corrija as pendências sem apagar',
    'Tire a moldura da imagem',
    'Publicar, eu autorizo',
  ])
    assert.ok(!isPublicationRepairRequest(text), text);
});

await test('reparo de prova não substitui hero com outro erro técnico', () => {
  const f = landingFixture();
  const hero = f.pages[0].blocks.find((block) => block.type === 'hero.landing');
  hero.props.badges = [
    { label: 'Entrega em um dia', evidence: 'Entrega em um dia' },
  ];
  hero.props.propriedadeInvalida = true;
  const after = repairPublicationProof(
    f.pages[0],
    f.images,
    f.tenant.brief,
  ).blocks.find((block) => block.id === hero.id);
  assert.equal(after.type, 'hero.landing');
  assert.equal(after.props.headline, hero.props.headline);
  assert.equal(after.props.image, hero.props.image);
  assert.deepEqual(after.props.cta, hero.props.cta);
  assert.deepEqual(after.props.badges, []);
});

await test('reparo elimina a prova sem inventar fatos e preserva os demais blocos e o snapshot', () => {
  const f = landingFixture();
  const page = f.pages[0];
  const original = structuredClone(page);
  const brief = {
    ...f.tenant.brief,
    evidence: [],
    intake: { ...f.tenant.brief.intake, evidence: [] },
  };
  const beforeBrief = structuredClone(brief);
  const repair = repairPublicationProof(page, f.images, brief);
  assert.ok(repair.summary.length);
  const repaired = { ...page, blocks: repair.blocks };
  assert.equal(landingClaims(repaired, f.images).length, 0);
  const proofIds = new Set(
    landingClaims(page, f.images).map((claim) => claim.block.id),
  );
  for (const block of page.blocks.filter((item) => !proofIds.has(item.id)))
    assert.deepEqual(
      repaired.blocks.find((item) => item.id === block.id),
      block,
    );
  assert.deepEqual(
    page,
    original,
    'função pura não altera nem o rascunho nem o publicado',
  );
  assert.deepEqual(brief, beforeBrief, 'autorização não se torna evidência');
  const before = new Set(
    lintPage(page, f.tenant.brand.design)
      .filter((item) => item.level === 'error')
      .map((item) => item.rule),
  );
  assert.deepEqual(
    lintPage(repaired, f.tenant.brand.design).filter(
      (item) => item.level === 'error' && !before.has(item.rule),
    ),
    [],
  );
});

await test('reparo corrige referências e remove apenas a foto falsa do depoimento confirmado', () => {
  const f = landingFixture();
  const hero = f.pages[0].blocks.find((block) => block.type === 'hero.landing');
  hero.props.badges = [
    { label: '12 acabamentos', evidence: 'evidência antiga' },
  ];
  const testimonials = f.pages[0].blocks.find(
    (block) => block.type === 'proof.testimonials',
  );
  testimonials.props.items[0].image = f.images[0].url;
  f.images[0].model = 'generated-fixture';
  testimonials.props.items[0].imageAlt = 'Retrato ilustrativo de uma pessoa';
  const repaired = {
    ...f.pages[0],
    blocks: repairPublicationProof(f.pages[0], f.images, f.tenant.brief).blocks,
  };
  const evidence = confirmedEvidence(f.tenant.brief);
  assert.ok(
    landingClaims(repaired, f.images).every((claim) =>
      claimSupported(claim, evidence),
    ),
  );
  const after = repaired.blocks.find((block) => block.id === testimonials.id)
    .props.items[0];
  assert.equal(after.image, undefined);
  assert.equal(after.quote, testimonials.props.items[0].quote);
  assert.equal(after.author, testimonials.props.items[0].author);
});

await test('painel classifica falta de prova como recomendação e mantém erros técnicos', () => {
  const f = landingFixture();
  f.tenant.brief = {
    ...f.tenant.brief,
    evidence: [],
    intake: { ...f.tenant.brief.intake, evidence: [] },
  };
  const state = workspaceState(f.tenant, f.pages, f.images);
  assert.ok(
    state.pages[0].warnings.some((message) =>
      /evidência|confirmad/.test(message),
    ),
  );
  assert.ok(
    !state.pages[0].errors.some((message) =>
      /evidência|confirmad/.test(message),
    ),
  );
  f.pages[0].blocks[0].props.desconhecido = true;
  assert.ok(
    workspaceState(f.tenant, f.pages, f.images).pages[0].errors.some(
      (message) => /Unrecognized|desconhecido/.test(message),
    ),
  );
});
