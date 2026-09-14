import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
const { landingFixture, landingEvidence } = await j.import(
  './helpers/landing-data.ts',
);
const { publicationPlan, pendenciasContext, evidenceContext } = await j.import(
  '../lib/taste/pendencias.ts',
);
const { blockSchemas } = await j.import('../lib/blocks/registry.ts');
const { systemPrompt } = await j.import('../lib/taste/prompt.ts');

const plan = (f, operatorText = '') =>
  publicationPlan({
    pages: f.pages,
    images: f.images,
    brand: f.tenant.brand,
    brief: f.tenant.brief,
    operatorText,
  });
const find = (f, type) => f.pages[0].blocks.find((b) => b.type === type);

await test('prova sustentada por outra grafia vira alinhamento por caminho', () => {
  const f = landingFixture();
  // Caso villa-piva: o fato existe no cadastro com outra grafia e o bloco
  // aponta para uma frase que não está confirmada.
  find(f, 'hero.landing').props.badges = [
    { label: '12 acabamentos', evidence: 'Doze acabamentos disponíveis' },
  ];
  f.tenant.brief = {
    ...f.tenant.brief,
    evidence: [],
    intake: { ...f.tenant.brief.intake, evidence: landingEvidence },
  };
  const hero = plan(f).find((item) => item.bloco === 'hero');
  assert.equal(hero.acao, 'alinhar');
  assert.deepEqual(hero.alinhar, [
    {
      bloco: 'hero',
      caminho: 'badges.0.evidence',
      valor: '12 acabamentos disponíveis',
    },
  ]);
  assert.equal(hero.nivel, 'recomendacao');
  assert.ok(!hero.confirmar);
});

await test('fato ausente oferece reparo sem exigir repetição pelo operador', () => {
  const f = landingFixture();
  find(f, 'hero.landing').props.badges = [
    { label: 'Entrega em 5 dias', evidence: 'Entrega em 5 dias' },
  ];
  // O depoimento continua com a redação do cadastro, que não é confirmável
  // pelo chat: factWritten compara frases inteiras e ela tem ponto no meio.
  f.tenant.brief = {
    ...f.tenant.brief,
    evidence: f.tenant.brief.evidence.filter(
      (fact) => fact !== landingEvidence[2],
    ),
  };
  const semEscrita = plan(f);
  const hero = semEscrita.find((item) => item.bloco === 'hero');
  assert.equal(hero.acao, 'reparar-prova');
  assert.deepEqual(hero.confirmar, [
    { frase: 'Entrega em 5 dias', escrita: false, canal: 'chat' },
  ]);
  const depoimento = semEscrita.find((item) => item.bloco === 'testimonials');
  assert.equal(depoimento.confirmar[0].frase, landingEvidence[2]);
  assert.equal(depoimento.confirmar[0].canal, 'dados');

  const escrito = plan(f, 'Entrega em 5 dias. Já combinamos isso.').find(
    (item) => item.bloco === 'hero',
  );
  assert.equal(escrito.confirmar[0].escrita, true);
});

await test('evidência do cadastro com até 160 caracteres cabe no alinhamento', () => {
  const f = landingFixture();
  const longa = `Recebemos o selo de qualidade ${'x'.repeat(120)}`;
  assert.ok(longa.length > 140);
  find(f, 'hero.landing').props.badges = [
    { label: 'Selo de qualidade', evidence: 'Selo de qualidade' },
  ];
  f.tenant.brief = {
    ...f.tenant.brief,
    evidence: [...f.tenant.brief.evidence, longa],
    intake: { ...f.tenant.brief.intake, evidence: [] },
  };
  const hero = plan(f).find((item) => item.bloco === 'hero');
  assert.equal(hero.acao, 'alinhar');
  assert.equal(hero.alinhar[0].valor, longa);
});

function ratioFixture(layout, ratio) {
  const page = {
    id: 'home',
    tenantId: 'ratio',
    slug: '',
    type: 'page',
    title: 'Início',
    seo: { title: 'Início do site', description: 'Página de teste' },
    meta: {},
    navOrder: 0,
    publishedBlocks: null,
    publishedSeo: null,
    blocks: [
      {
        id: 'foto',
        type: 'media.image',
        props: blockSchemas['media.image'].parse({
          layout,
          src: 'https://assets.test/foto.webp',
          alt: 'Bancada de madeira clara vista de frente',
        }),
      },
    ],
  };
  const image = (seq, value, name) => ({
    id: `image-${seq}`,
    seq,
    kind: 'foto',
    ratio: value,
    model: 'upload',
    status: 'disponivel',
    url: `https://assets.test/${name}.webp`,
    blobPath: `tenants/ratio/uploads/${name}.webp`,
    critique: {},
    targetBlock: null,
    requestText: 'fixture',
    referenceUrls: [],
    batchId: '',
    score: null,
    alt: null,
    description: null,
    createdAt: '2026-09-13T00:00:00Z',
  });
  return {
    pages: [page],
    images: [image(1, ratio, 'foto'), image(2, '16:9', 'outra')],
  };
}

await test('recomendação de proporção traz biblioteca, layouts e geração', () => {
  const f = ratioFixture('wide', '4:5');
  const item = publicationPlan({ ...f, brief: {} }).find(
    (entry) => entry.regra === 'imagem-proporcao',
  );
  assert.equal(item.nivel, 'recomendacao');
  assert.equal(item.acao, 'imagem');
  assert.equal(item.imagem.numero, '#1');
  assert.equal(item.imagem.atual, '4:5');
  assert.equal(item.imagem.esperada, '16:9');
  // Outro layout do mesmo bloco exibe a proporção que a foto já tem.
  assert.deepEqual(item.imagem.layouts, ['portrait']);
  assert.deepEqual(
    item.imagem.biblioteca.map((photo) => photo.numero),
    ['#2'],
  );
  assert.deepEqual(item.imagem.gerar, {
    ferramenta: 'update_image',
    image: '#1',
    ratio: '16:9',
  });
});

await test('foto na proporção do bloco não gera recomendação', () => {
  const f = ratioFixture('wide', '16:9');
  assert.deepEqual(
    publicationPlan({ ...f, brief: {} }).filter(
      (entry) => entry.regra === 'imagem-proporcao',
    ),
    [],
  );
});

await test('contexto do prompt lista erros antes de recomendações e corta o excesso', () => {
  const f = landingFixture();
  f.tenant.brief = { ...f.tenant.brief, evidence: [], intake: {} };
  const items = plan(f);
  assert.ok(items.length > 1);
  const texto = pendenciasContext(items, 1);
  assert.match(texto, /Só erros técnicos bloqueiam/);
  assert.match(texto.split('\n')[1], /^- Recomendação/);
  assert.match(texto, /e mais \d+ pendência/);
  assert.equal(pendenciasContext([]), undefined);

  const vazio = evidenceContext({});
  assert.match(vazio, /Nenhum fato confirmado/);
  const cheio = evidenceContext({
    evidence: ['Prêmio Estadão 2023'],
    intake: { evidence: ['Envase no mesmo dia'] },
  });
  assert.match(cheio, /"Prêmio Estadão 2023"/);
  assert.match(cheio, /"Envase no mesmo dia"/);
});

await test('as seções entram na edição e ficam fora das fases da geração', () => {
  const tenant = {
    id: 't',
    slug: 't',
    name: 'Cliente',
    brand: {},
    dials: {},
    brief: {},
    imageGuide: {},
    contacts: {},
    whatsapp: null,
    contactEmail: null,
  };
  const context = {
    pendencias: 'PENDENCIA-SINTETICA',
    evidencia: 'EVIDENCIA-SINTETICA',
  };
  const edicao = systemPrompt(tenant, '', '/', '', {
    ...context,
    editing: true,
  });
  assert.match(edicao, /## Pendências de publicação\nPENDENCIA-SINTETICA/);
  assert.match(edicao, /## Evidência confirmada\nEVIDENCIA-SINTETICA/);
  assert.match(
    edicao,
    /Pedido explícito de resolver pendências: execute repair_publication/,
  );
  const composicao = systemPrompt(tenant, '', '/', '', { phase: 'composicao' });
  assert.ok(!composicao.includes('PENDENCIA-SINTETICA'));
});
