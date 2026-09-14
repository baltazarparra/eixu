import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
import { loadModule } from './helpers/load-module.mjs';
const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
const { landingFixture, landingEvidence } = await j.import(
  './helpers/landing-data.ts',
);
const { editPolicyFor } = await j.import('../lib/ai/edit-policy.ts');
const { pageRevision } = await j.import('../lib/ai/page-edits.ts');
const { createEditReceipt } = await j.import('../lib/ai/edit-receipt.ts');
const { publicationPlan, pendenciasContext } = await j.import(
  '../lib/taste/pendencias.ts',
);
const { completeChatStream } = await j.import('../lib/ai/chat-stream.ts');
const { chatFixture, chatRequest } = await import('./helpers/chat-fixture.mjs');

/** Caso villa-piva em memória: o fato está no cadastro com outra grafia e o
 * bloco aponta para uma frase que a validação não conhece. */
function broken() {
  const f = landingFixture();
  const hero = f.pages[0].blocks.find((b) => b.type === 'hero.landing');
  hero.props.badges = [
    { label: '12 acabamentos', evidence: 'Doze acabamentos disponíveis' },
  ];
  f.tenant.brief = {
    ...f.tenant.brief,
    evidence: [],
    intake: { ...f.tenant.brief.intake, evidence: landingEvidence },
  };
  return f;
}

async function fixture(
  text = 'Resolva as pendências de publicação.',
  image,
  missingEvidence = false,
) {
  const f = broken();
  if (missingEvidence)
    f.tenant.brief = {
      ...f.tenant.brief,
      evidence: [],
      intake: { ...f.tenant.brief.intake, evidence: [] },
    };
  const writes = [];
  const revisions = [];
  const published = [];
  const executeQuery = async (sql, values = []) => {
    if (sql.includes('update pages set blocks')) {
      const [blocks, pageId, tenantId, expected] = values;
      const page = f.pages.find(
        (candidate) =>
          candidate.id === pageId && candidate.tenantId === tenantId,
      );
      if (!page) return [];
      if (
        pageRevision(page) !==
        pageRevision({ blocks: JSON.parse(expected) })
      )
        return [];
      page.blocks = JSON.parse(blocks);
      writes.push({ page: page.slug });
      return [{ id: pageId }];
    }
    if (sql.includes("jsonb_set(brief, '{evidence}')")) {
      const [next, tenantId, expected] = values;
      if (JSON.stringify(f.tenant.brief.evidence ?? null) !== expected)
        return [];
      f.tenant.brief = {
        ...f.tenant.brief,
        evidence: JSON.parse(next),
      };
      writes.push({ evidence: JSON.parse(next) });
      return [{ id: tenantId }];
    }
    if (
      sql.startsWith('SAVEPOINT') ||
      sql.startsWith('RELEASE SAVEPOINT') ||
      sql.startsWith('ROLLBACK TO SAVEPOINT') ||
      sql.includes('insert into page_revisions') ||
      sql.includes('delete from page_revisions')
    )
      return [];
    throw new Error(`I/O fora do escopo da fixture: ${sql}`);
  };
  const mocks = {
    '@/lib/sites/publish': {
      publishSite: async (tenant, page) => {
        published.push({ brief: structuredClone(tenant.brief), page });
        return {
          published: [page ?? '/'],
          blocked: [],
          url: 'https://fixture.test',
        };
      },
    },
    '@/lib/db': {
      db:
        () =>
        async (parts, ...values) => {
          const sql = parts.join('?');
          if (sql.includes('update pages set blocks')) {
            const [blocks, pageId, tenantId, expected] = values;
            const page = f.pages.find(
              (p) => p.id === pageId && p.tenantId === tenantId,
            );
            if (!page) return [];
            if (
              pageRevision(page) !==
              pageRevision({ blocks: JSON.parse(expected) })
            )
              return [];
            page.blocks = JSON.parse(blocks);
            writes.push({ page: page.slug });
            return [{ id: pageId }];
          }
          if (sql.includes("jsonb_set(brief, '{evidence}'")) {
            const [next, tenantId, expected] = values;
            if (JSON.stringify(f.tenant.brief.evidence ?? null) !== expected)
              return [];
            f.tenant.brief = {
              ...f.tenant.brief,
              evidence: JSON.parse(next),
            };
            writes.push({ evidence: JSON.parse(next) });
            return [{ id: tenantId }];
          }
          throw new Error(`I/O fora do escopo da fixture: ${sql}`);
        },
      transaction: async (run) =>
        run({
          query: async (sql, values = []) => ({
            rows: await executeQuery(sql, values),
          }),
        }),
    },
    '@/lib/tenant-queries': {
      ...(await j.import('../lib/tenant-queries.ts')),
      getPage: async (tenantId, slug) =>
        f.pages.find((p) => p.tenantId === tenantId && p.slug === slug),
      listPages: async () => f.pages,
    },
    '@/lib/images/queries': {
      ...(await j.import('../lib/images/queries.ts')),
      listImages: async () => f.images,
      getImageByNumber: async (_tenantId, seq) =>
        f.images.find((entry) => entry.seq === seq) ?? null,
    },
    '@/lib/images/generation-lock': {
      withSceneGenerationLock: async (_tenantId, run) => run(),
    },
    '@/lib/images/revise': {
      reviseImage: async (_tenant, previous, request, options) => {
        revisions.push({ seq: previous.seq, request, options });
        return {
          ...previous,
          id: 'revisada',
          seq: 99,
          ratio: options?.ratio ?? previous.ratio,
          url: 'https://assets.test/revisada.webp',
          critique: {},
          score: 8,
        };
      },
    },
    '@/lib/images/replacement': {
      replaceDraftImage: async () => ['/'],
    },
  };
  mocks['@/lib/sites/edits'] = await loadModule('lib/sites/edits.ts', mocks);
  const { buildTools } = await loadModule('lib/ai/tools.ts', mocks);
  const tools = buildTools(f.tenant, {
    lastUserText: text,
    operatorText: text,
    editPolicy: editPolicyFor(text, f.pages, ''),
    ...image,
  });
  return {
    ...f,
    tools,
    writes,
    revisions,
    published,
    policy: editPolicyFor(text, f.pages, ''),
  };
}

await test('reparo real salva o rascunho sem pedir fatos, publicar ou apagar evidências', async () => {
  const f = await fixture(undefined, undefined, true);
  const original = structuredClone(f.pages[0].blocks);
  f.pages[0].publishedBlocks = structuredClone(original);
  const beforeBrief = structuredClone(f.tenant.brief);
  const result = await f.tools.repair_publication.execute({});
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.changed, true);
  assert.ok(result.summary.some((line) => /retir|substituí/i.test(line)));
  assert.deepEqual(f.tenant.brief, beforeBrief);
  assert.deepEqual(f.pages[0].publishedBlocks, original);
  assert.deepEqual(f.published, []);
  assert.equal(f.writes.length, 1);
  assert.deepEqual(
    (await f.tools.repair_publication.execute({})).changed,
    false,
  );
});

await test('reparo não usa autorização visual para retirar conteúdo', async () => {
  const f = await fixture('Tire a moldura da imagem.', undefined, true);
  assert.equal(f.tools.repair_publication, undefined);
  assert.deepEqual(f.writes, []);
});

await test('pedido visual real nunca expõe repair_publication e recebe o contrato da faixa', async () => {
  const text =
    'inserir uma imagem de fundo na parte que cita o telefone e o endereço. Adicionar ícones nessa parte também. corrigir';
  const f = await fixture(text, undefined, true);
  assert.equal(f.tools.repair_publication, undefined);
  assert.ok(f.tools.edit_page);
  assert.deepEqual(f.writes, []);
});

await test('publicação usa a evidência registrada neste mesmo turno', async () => {
  const fact = 'Entrega em cinco dias úteis';
  const f = await fixture(fact);
  const confirmed = await f.tools.confirm_evidence.execute({ facts: [fact] });
  assert.equal(confirmed.ok, true);
  await f.tools.publish_site.execute({});
  await f.tools.publish_page.execute({ page: '' });
  assert.equal(f.published.length, 2);
  assert.ok(f.published.every((call) => call.brief.evidence.includes(fact)));
});

await test('a validação do chat entrega o plano e a edição resolve a pendência', async () => {
  const f = await fixture();
  const before = await f.tools.lint_site.execute({});
  const hero = before.plano.find((item) => item.bloco === 'hero');
  assert.equal(hero.acao, 'alinhar');
  const fix = hero.alinhar[0];
  assert.equal(fix.caminho, 'badges.0.evidence');

  const edited = await f.tools.edit_page.execute({
    page: '',
    revision: pageRevision(f.pages[0]),
    operations: [
      { op: 'set', block: fix.bloco, path: fix.caminho, value: fix.valor },
    ],
  });
  assert.equal(edited.ok, true, JSON.stringify(edited));
  assert.equal(f.writes.length, 1);
  // O recibo da edição já traz a validação nova, sem outro lint_site.
  assert.ok(Array.isArray(edited.publicationPending));
  assert.ok(
    !edited.plano.some(
      (item) => item.bloco === 'hero' && item.regra === 'landing-prova',
    ),
    JSON.stringify(edited.plano),
  );
});

await test('pre-flight de página acusa o gate de site que bloqueia a publicação', async () => {
  const f = await fixture();
  const report = await f.tools.lint_page.execute({ page: '' });
  assert.equal(report.aprovado, true);
  assert.match(report.relatorio, /landing-prova/);
  assert.ok(report.plano.every((item) => item.pagina === '/'));
});

await test('confirm_evidence devolve o plano atualizado após gravar o fato', async () => {
  const fato = 'Entrega em cinco dias úteis';
  const f = await fixture(fato);
  f.pages[0].blocks.find((b) => b.type === 'hero.landing').props.badges = [
    { label: fato, evidence: fato },
  ];
  const pendente = await f.tools.lint_site.execute({});
  const antes = pendente.plano.find((item) => item.bloco === 'hero');
  assert.deepEqual(antes.confirmar, [
    { frase: fato, escrita: true, canal: 'chat' },
  ]);
  const saved = await f.tools.confirm_evidence.execute({ facts: [fato] });
  assert.equal(saved.ok, true, JSON.stringify(saved));
  assert.ok(Array.isArray(saved.plano));
  assert.ok(
    !saved.plano.some(
      (item) => item.bloco === 'hero' && item.regra === 'landing-prova',
    ),
    JSON.stringify(saved.plano),
  );
});

await test('update_image gera a nova versão na proporção pedida', async () => {
  const f = await fixture();
  assert.equal(f.images[0].ratio, '16:9');
  const result = await f.tools.update_image.execute({
    image: '#1',
    request: 'Mesma cena, enquadramento mais fechado',
    ratio: '4:3',
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(f.revisions[0].options.ratio, '4:3');
  assert.equal(result.numero, '#99');
  // A original continua no acervo com a proporção antiga.
  assert.match(result.aviso ?? '', /4:3/);
  assert.equal(result.anterior, '#1');
});

await test('pendência de slide oferece acervo, nova versão e foto inteira', () => {
  const f = landingFixture();
  const hero = f.pages[0].blocks.find((block) => block.id === 'hero');
  hero.props.slides = [
    {
      src: f.images[1].url,
      alt: 'Detalhe quadrado da mesa e do acabamento',
    },
  ];
  f.images[1].ratio = '1:1';
  f.images[2].ratio = '16:9';
  const item = publicationPlan({
    pages: f.pages,
    images: f.images,
    brand: f.tenant.brand,
    brief: f.tenant.brief,
  }).find(
    (entry) =>
      entry.regra === 'imagem-proporcao' &&
      entry.bloco === 'hero' &&
      entry.imagem?.numero === '#2',
  );
  assert.equal(item.acao, 'imagem');
  assert.ok(item.imagem.biblioteca.some((photo) => photo.numero === '#3'));
  assert.deepEqual(item.imagem.gerar, {
    ferramenta: 'update_image',
    image: '#2',
    ratio: '16:9',
  });
  assert.deepEqual(item.imagem.apresentacao, {
    ferramenta: 'edit_page',
    caminho: 'imagePresentation.fit',
    valor: 'contain',
  });
  assert.match(pendenciasContext([item]), /mostrar a foto inteira/);
});

await test('o pedido de resolver pendências não vira remoção nem escopo visual', async () => {
  const f = broken();
  for (const text of [
    'Resolva as pendências de publicação.',
    '2 pendências para publicar\n/O selo do hero não está sustentado pela evidência informada.\nRecomendação: #19 é 12:5 e hero.landing (stage) exibe 16:9. Troque a imagem, mude o layout ou gere a cena na proporção certa.',
  ]) {
    const policy = editPolicyFor(text, f.pages, '');
    assert.equal(policy.kind, 'edit');
    assert.equal(policy.removal, false);
    assert.ok(!policy.visualOnly);
  }
  const { tools } = await fixture();
  for (const name of [
    'edit_page',
    'confirm_evidence',
    'update_image',
    'lint_site',
  ])
    assert.ok(tools[name], `${name} disponível`);
});

await test('o fechamento nomeia a imagem nova e as frases que faltam', async () => {
  const receipt = createEditReceipt();
  receipt.observe(
    'update_image',
    { image: '#8' },
    { ok: true, anterior: '#8', numero: '#21', paginasAtualizadas: ['/'] },
  );
  receipt.observe(
    'edit_page',
    { page: '' },
    { ok: true, changed: true, summary: ['Em “Prova”: ajuste salvo.'] },
  );
  receipt.observe(
    'lint_site',
    {},
    {
      findings: [
        { level: 'error', rule: 'landing-prova', message: 'Falta prova.' },
      ],
      plano: [
        {
          regra: 'landing-prova',
          nivel: 'erro',
          pagina: '/',
          acao: 'confirmar',
          confirmar: [
            { frase: 'Três cocos por litro', escrita: false, canal: 'chat' },
            {
              frase: 'Clara: coube. Resultado: bom.',
              escrita: false,
              canal: 'dados',
            },
          ],
        },
      ],
    },
  );
  const text = receipt.text();
  assert.match(text, /Imagem #8 atualizada: nova versão #21 aplicada em \//);
  assert.match(text, /não impedem a publicação/);
  assert.match(text, /sem exigir que você repita frases/);
  assert.doesNotMatch(text, /precisa escrever|está bloqueada/);
});

await test('o recibo substitui o texto do modelo mesmo com imagem no turno', async () => {
  const receipt = createEditReceipt();
  const id = 'a';
  const chunks = [
    { type: 'start-step' },
    { type: 'text-start', id },
    {
      type: 'text-delta',
      id,
      delta: 'Registrei os fatos e o site já pode ser publicado.',
    },
    { type: 'text-end', id },
    { type: 'finish' },
  ];
  receipt.observe(
    'update_image',
    { image: '#8' },
    { ok: true, anterior: '#8', numero: '#21', paginasAtualizadas: [] },
  );
  receipt.observe(
    'confirm_evidence',
    {},
    { ok: true, added: ['Prêmio Estadão 2023'], findings: [], plano: [] },
  );
  let saved = '';
  const out = [];
  for await (const chunk of completeChatStream(ReadableStream.from(chunks), {
    receipt: () => receipt.text(),
    summary: async () => 'resumo',
    persist: async (value) => {
      saved = value;
    },
  }))
    out.push(chunk);
  const streamed = out
    .filter((chunk) => chunk.type === 'text-delta')
    .map((chunk) => chunk.delta)
    .join('');
  assert.ok(!streamed.includes('já pode ser publicado'));
  assert.match(streamed, /Fatos registrados: Prêmio Estadão 2023/);
  assert.match(streamed, /nova versão #21 salva na biblioteca/);
  assert.match(
    streamed,
    /A verificação atual não encontrou bloqueios de publicação/,
  );
  assert.equal(saved, streamed);
});

await test('a rota entrega as pendências e a evidência ao turno de edição', async () => {
  const site = broken();
  const f = await chatFixture({
    sitePages: site.pages,
    images: site.images,
    tenant: {
      brand: site.tenant.brand,
      brief: site.tenant.brief,
      dials: site.tenant.dials,
    },
  });
  f.state.pages = site.pages.map((page) => ({
    slug: page.slug,
    type: page.type,
    title: page.title,
    blocks: page.blocks.length,
    dirty: true,
    published: false,
    publishedAt: null,
    errors: [],
    warnings: [],
  }));
  await (
    await f.POST(chatRequest('Resolva as pendências de publicação.'))
  ).text();
  const context = f.prompts.at(-1);
  assert.equal(context.editing, true);
  assert.match(context.pendencias, /Recomendação landing-prova/);
  assert.match(context.pendencias, /Ação alinhar: edit_page com set em/);
  assert.match(context.evidencia, /12 acabamentos disponíveis/);

  // Uma fase da geração continua sem essas seções: o runner não muda.
  await (await f.POST(chatRequest('Monte o site.', 'composicao'))).text();
  assert.equal(f.prompts.at(-1).pendencias, undefined);
  assert.equal(f.prompts.at(-1).evidencia, undefined);
});
