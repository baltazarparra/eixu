import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
import {
  editPages,
  editTenant,
  pageEditFixture,
} from './helpers/page-edit-fixture.mjs';
const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
const { applyPageEdit, editingPageContext, pageRevision, pageEditSchema } =
  await j.import('../lib/ai/page-edits.ts');
const { editPolicyFor } = await j.import('../lib/ai/edit-policy.ts');
const { createEditReceipt } = await j.import('../lib/ai/edit-receipt.ts');
const { sectionBackgrounds, sectionColorVars } = await j.import(
  '../lib/blocks/section-colors.ts',
);
const { contrastRatio } = await j.import('../lib/blocks/contrast.ts');
const { blockSchemas } = await j.import('../lib/blocks/registry.ts');
const input = (page, operations) => ({
  page: page.slug,
  revision: pageRevision(page),
  operations,
});

await test('troca literal, campo de lista e cor em um lote preservam o restante e o publicado', async () => {
  const f = await pageEditFixture();
  const expected = structuredClone(f.pages);
  const result = await f.tools.edit_page.execute(
    input(f.pages[0], [
      {
        op: 'replace_text',
        from: 'Escolha com calma.',
        to: 'Compare os acabamentos.',
      },
      {
        op: 'set',
        block: 'faq',
        path: 'items.1.q',
        value: 'O que considerar no ambiente?',
      },
      {
        op: 'set',
        block: 'intro',
        path: 'presentation.background',
        value: '#173f54',
      },
    ]),
  );
  assert.equal(result.ok, true, JSON.stringify(result));
  expected[0].blocks[2].props.body = expected[0].blocks[2].props.body.replace(
    'Escolha com calma.',
    'Compare os acabamentos.',
  );
  expected[0].blocks[3].props.items[1].q = 'O que considerar no ambiente?';
  expected[0].blocks[2].props.presentation.background = '#173f54';
  assert.deepEqual(f.pages, expected);
  assert.equal(f.writes.length, 1);
  assert.equal(result.saved, 'draft');
  assert.equal(result.changes.length, 3);
  assert.equal(result.revision, pageRevision(f.pages[0]));
});

await test('alvo ambíguo, texto repetido e texto ausente recusam o lote inteiro', async () => {
  for (const operation of [
    { op: 'replace_text', from: 'Ver materiais', to: 'Ver opções' },
    { op: 'replace_text', from: 'Texto que não existe', to: 'Outro texto' },
    { op: 'set', block: 'inexistente', path: 'title', value: 'Um título novo' },
  ]) {
    const f = await pageEditFixture();
    const result = await f.tools.edit_page.execute(
      input(f.pages[0], [
        { op: 'set', block: 'intro', path: 'title', value: 'Primeiro ajuste' },
        operation,
      ]),
    );
    assert.ok(result.error);
    assert.deepEqual(f.pages, editPages());
    assert.equal(f.writes.length, 0);
  }
  const page = editPages()[0];
  page.blocks.push({
    id: 'intro2',
    type: 'editorial.text',
    props: { ...page.blocks[2].props },
  });
  assert.throws(
    () =>
      applyPageEdit(
        page,
        input(page, [
          {
            op: 'set',
            block: 'editorial',
            path: 'title',
            value: 'Novo título',
          },
        ]),
      ),
    /ambíguo/,
  );
});

await test('contagem explícita troca todas as ocorrências sem tocar links ou outra página', async () => {
  const f = await pageEditFixture();
  const result = await f.tools.edit_page.execute(
    input(f.pages[0], [
      {
        op: 'replace_text',
        from: 'Ver materiais',
        to: 'Ver opções',
        occurrences: 2,
      },
    ]),
  );
  assert.equal(result.ok, true);
  assert.equal(f.pages[0].blocks[0].props.links[0].href, '/materiais');
  assert.equal(f.pages[0].blocks[4].props.cta.href, '/materiais');
  assert.deepEqual(f.pages[1], editPages()[1]);
});

await test('inserção e movimento usam âncoras antes/depois inclusive após o footer', async () => {
  const f = await pageEditFixture();
  const result = await f.tools.edit_page.execute(
    input(f.pages[0], [
      {
        op: 'insert',
        block: {
          type: 'editorial.text',
          props: {
            title: 'Cuidados com materiais',
            body: 'Considere as características do material antes de escolher os produtos de limpeza.',
          },
        },
        position: { relation: 'after', block: 'footer' },
      },
      {
        op: 'move',
        block: 'faq',
        position: { relation: 'before', block: 'intro' },
      },
    ]),
  );
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(f.pages[0].blocks.map((b) => b.id).slice(0, 6), [
    'nav',
    'hero',
    'faq',
    'intro',
    'cta',
    'footer',
  ]);
  assert.equal(f.pages[0].blocks.at(-1).props.title, 'Cuidados com materiais');
  assert.equal(result.changes[0].to, 6);
});

await test('schema inválido, campos desconhecidos, caminhos perigosos e baixo contraste não gravam', async () => {
  const operations = [
    { op: 'set', block: 'faq', path: 'items.1.typo', value: 'erro' },
    { op: 'set', block: 'faq', path: 'items.4.q', value: 'inexistente' },
    { op: 'set', block: 'intro', path: '__proto__.polluted', value: true },
    {
      op: 'set',
      block: 'intro',
      path: 'presentation.background',
      value: 'url(https://invalid.test)',
    },
    {
      op: 'set',
      block: 'intro',
      path: 'presentation',
      value: { background: '#ffffff', foreground: '#eeeeee' },
    },
    { op: 'unset', block: 'intro', path: 'body' },
    {
      op: 'insert',
      block: { type: 'cta.band', props: {} },
      position: { relation: 'end' },
    },
    {
      op: 'insert',
      block: { type: 'footer.compact', props: { logoText: 'Duplicado' } },
      position: { relation: 'end' },
    },
  ];
  for (const operation of operations) {
    const f = await pageEditFixture();
    const result = await f.tools.edit_page.execute(
      input(f.pages[0], [operation]),
    );
    assert.ok(result.error, JSON.stringify(operation));
    assert.equal(f.writes.length, 0);
  }
  assert.equal({}.polluted, undefined);
});

await test('revisão desatualizada e escrita concorrente preservam a versão mais recente', async () => {
  for (const during of [false, true]) {
    const f = await pageEditFixture(undefined, {
      race: during
        ? (page) => {
            page.blocks[2].props.title = 'Outra aba';
          }
        : undefined,
    });
    const request = input(f.pages[0], [
      { op: 'set', block: 'intro', path: 'title', value: 'Esta aba' },
    ]);
    if (!during) f.pages[0].blocks[2].props.title = 'Outra aba';
    const result = await f.tools.edit_page.execute(request);
    assert.match(result.error, /mudou/);
    assert.equal(f.pages[0].blocks[2].props.title, 'Outra aba');
    assert.equal(f.writes.length, 0);
  }
});

await test('no-op não grava e revisão JSONB independe da ordem de chaves', async () => {
  const f = await pageEditFixture();
  const result = await f.tools.edit_page.execute(
    input(f.pages[0], [
      { op: 'set', block: 'intro', path: 'title', value: 'Como escolher' },
    ]),
  );
  assert.equal(result.changed, false);
  assert.equal(f.writes.length, 0);
  const reordered = structuredClone(f.pages[0]);
  reordered.blocks = reordered.blocks.map(({ id, type, props }) => ({
    props,
    type,
    id,
  }));
  assert.equal(pageRevision(reordered), pageRevision(f.pages[0]));
});

await test('escopo do cabeçalho também protege edit_page e pedidos mistos seguem edição geral', () => {
  const page = editPages()[0];
  const policy = editPolicyFor('Deixe o cabeçalho fixo e com fundo escuro', [
    page,
  ]);
  assert.throws(
    () =>
      applyPageEdit(
        page,
        input(page, [
          { op: 'set', block: 'intro', path: 'title', value: 'Fora do pedido' },
        ]),
        policy,
      ),
    /somente os cabeçalhos/,
  );
  assert.throws(
    () =>
      applyPageEdit(
        page,
        input(page, [{ op: 'remove', block: 'nav' }]),
        policy,
      ),
    /somente os campos/,
  );
  assert.equal(
    editPolicyFor('Deixe o cabeçalho fixo e troque o texto do botão', [page])
      .kind,
    'edit',
  );
});

await test('paleta local preserva o hex pedido e fornece texto e apoio legíveis', () => {
  for (const color of ['#c45c26', '#000000', '#ffffff', '#173f54', '#ff00ff']) {
    const vars = sectionColorVars({ background: color }, {});
    assert.equal(vars['--paper'], color);
    assert.ok(contrastRatio(vars['--ink'], color) >= 4.5);
    assert.ok(contrastRatio(vars['--muted'], color) >= 4.5);
  }
});

await test('fundo transparente mantém superfícies internas e exige contraste automático', async () => {
  const { themeVars, surfaceOf, logoFor } = await j.import(
    '../lib/blocks/theme.ts',
  );
  const brand = { ink: '#14161a', paper: '#ffffff', surface: '#ebebe9' };
  const vars = sectionColorVars({ background: 'transparent' }, brand);
  assert.equal(vars.backgroundColor, 'transparent');
  assert.equal(vars['--surface'], themeVars(brand)['--surface']);
  assert.ok(contrastRatio(vars['--ink'], brand.paper) >= 4.5);
  assert.equal(surfaceOf(brand, 'ink', 'transparent'), brand.paper);
  assert.equal(
    logoFor(
      { ...brand, logoUrl: '/normal.png', logoDarkUrl: '/dark.png' },
      { tone: 'ink', background: 'transparent' },
    ),
    '/normal.png',
  );
  const props = editPages()[0].blocks[2].props;
  assert.equal(
    blockSchemas['editorial.text'].safeParse({
      ...props,
      presentation: { background: 'transparent' },
    }).success,
    true,
  );
  assert.equal(
    blockSchemas['editorial.text'].safeParse({
      ...props,
      presentation: { background: 'transparent', foreground: '#ffffff' },
    }).success,
    false,
  );
});

await test('degradê exige duas extremidades compatíveis e calcula uma única tinta AA', () => {
  const props = editPages()[0].blocks[2].props;
  const schema = blockSchemas['editorial.text'];
  const valid = schema.safeParse({
    ...props,
    presentation: {
      background: '#27272a',
      backgroundEnd: '#3f3f46',
      gradient: 'diagonal',
      decoration: 'none',
    },
  });
  assert.equal(valid.success, true, JSON.stringify(valid.error));
  const presentation = valid.data.presentation;
  const backgrounds = sectionBackgrounds(presentation, editTenant.brand);
  const vars = sectionColorVars(presentation, editTenant.brand);
  assert.deepEqual(backgrounds, ['#27272a', '#3f3f46']);
  assert.match(vars.backgroundImage, /^linear-gradient\(160deg,/);
  for (const background of backgrounds)
    assert.ok(contrastRatio(vars.color, background) >= 4.5);

  for (const presentation of [
    { backgroundEnd: '#3f3f46', gradient: 'diagonal' },
    { background: '#27272a', backgroundEnd: '#3f3f46' },
    {
      background: 'transparent',
      backgroundEnd: '#3f3f46',
      gradient: 'right',
    },
  ])
    assert.equal(
      schema.safeParse({ ...props, presentation }).success,
      false,
      JSON.stringify(presentation),
    );

  const incompatible = schema.safeParse({
    ...props,
    presentation: {
      background: '#000000',
      backgroundEnd: '#ffffff',
      gradient: 'down',
    },
  });
  assert.equal(incompatible.success, false);
  assert.match(
    incompatible.error.issues.map((issue) => issue.message).join(' '),
    /mesma cor de texto.*Use backgroundEnd #[0-9a-f]{6}/i,
  );

  const explicit = schema.safeParse({
    ...props,
    presentation: {
      background: '#27272a',
      backgroundEnd: '#f4f4f5',
      gradient: 'right',
      foreground: '#ffffff',
    },
  });
  assert.equal(explicit.success, false);
  assert.match(
    explicit.error.issues.map((issue) => issue.message).join(' '),
    /duas extremidades/,
  );
});

await test('pedido visual por família alcança todas as páginas, salvo página explícita', async () => {
  const pages = editPages();
  for (const [request, family, block] of [
    ['Deixa o footer inteiro na cor cinza', 'footer', 'footer'],
    ['Quero um degradê mais elegante no rodapé', 'footer', 'footer'],
    ['Tira a lavagem do hero', 'hero', 'hero'],
    ['Deixa o texto do cabeçalho claro', 'nav', 'nav'],
  ]) {
    const policy = editPolicyFor(request, pages);
    assert.equal(policy.visualOnly, true, request);
    assert.deepEqual(policy.visualFamilies, [family], request);
    assert.deepEqual(
      policy.targets,
      pages.map((page) => ({ page: page.slug, block })),
      request,
    );
    const context = editingPageContext(pages[0], pages, policy);
    assert.match(context, /Alvos visuais de outras páginas/);
    assert.match(context, new RegExp(pageRevision(pages[1])));
    assert.match(context, new RegExp(`"id":"${block}"`));
    const fixture = await pageEditFixture(request);
    assert.equal(fixture.tools.set_brand, undefined, request);
  }
  const local = editPolicyFor(
    'Na página Materiais, deixa o footer inteiro na cor cinza',
    pages,
  );
  assert.deepEqual(local.targets, [{ page: 'materiais', block: 'footer' }]);
});

await test('edição visual salva dispara medição dos blocos tocados e declara desativação', async () => {
  const calls = [];
  const measurement = {
    status: 'complete',
    ok: true,
    issues: [],
    viewports: [
      {
        viewport: 'desktop',
        width: 1440,
        blocks: [
          {
            blockId: 'intro',
            found: true,
            backgroundColor: 'rgb(39, 39, 42)',
            backgroundImage: 'none',
            minimumContrast: 14.89,
            visibleTexts: 2,
          },
        ],
      },
      {
        viewport: 'mobile',
        width: 390,
        blocks: [
          {
            blockId: 'intro',
            found: true,
            backgroundColor: 'rgb(39, 39, 42)',
            backgroundImage: 'none',
            minimumContrast: 14.89,
            visibleTexts: 2,
          },
        ],
      },
    ],
  };
  const f = await pageEditFixture(
    'Altere só o fundo do bloco "Como escolher" para #27272a.',
    {
      toolContext: {
        origin: 'http://preview.test',
        cookie: 'eixu_admin=sessao-de-teste',
      },
      measureEditedBlocks: async (...args) => {
        calls.push(args);
        return measurement;
      },
    },
  );
  const result = await f.tools.edit_page.execute(
    input(f.pages[0], [
      {
        op: 'set',
        block: 'intro',
        path: 'presentation.background',
        value: '#27272a',
      },
    ]),
  );
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.visualMeasurement, measurement);
  assert.equal(calls.length, 1);
  assert.equal(
    JSON.stringify(calls[0].slice(0, 4)),
    JSON.stringify(['http://preview.test', 'edit-fixture', '', ['intro']]),
  );
  assert.equal(calls[0][4].cookie, 'eixu_admin=sessao-de-teste');

  const previous = process.env.EIXU_REVIEW_CAPTURE;
  process.env.EIXU_REVIEW_CAPTURE = '0';
  try {
    const disabled = await pageEditFixture(
      'Altere só o fundo do bloco "Como escolher" para #27272a.',
      {
        toolContext: { origin: 'http://preview.test' },
        measureEditedBlocks: async () => assert.fail('Não deve abrir browser'),
      },
    );
    const output = await disabled.tools.edit_page.execute(
      input(disabled.pages[0], [
        {
          op: 'set',
          block: 'intro',
          path: 'presentation.background',
          value: '#27272a',
        },
      ]),
    );
    assert.equal(output.ok, true);
    assert.equal(output.visualMeasurement.status, 'disabled');
    assert.equal(output.visualMeasurement.ok, false);
    assert.match(output.visualMeasurement.issues[0], /EIXU_REVIEW_CAPTURE=0/);
  } finally {
    if (previous === undefined) delete process.env.EIXU_REVIEW_CAPTURE;
    else process.env.EIXU_REVIEW_CAPTURE = previous;
  }
});

await test('schema e contexto oferecem revisão atual sem uma leitura redundante', async () => {
  const f = await pageEditFixture();
  assert.match(f.instructions, new RegExp(pageRevision(f.pages[0])));
  assert.match(f.instructions, /items\.0\.title/);
  assert.equal(f.tools.update_block, undefined);
  assert.equal(
    pageEditSchema.safeParse(
      input(f.pages[0], [{ op: 'replace_text', from: 'X', to: 'Y' }]),
    ).success,
    true,
  );
});

await test('mensagem real fica na edição da faixa e recebe limite e alternativa executáveis', async () => {
  const text =
    'inserir uma imagem de fundo na parte que cita o telefone e o endereço. Adicionar ícones nessa parte também. corrigir';
  const f = await pageEditFixture(text, { publication: true });
  assert.equal(f.tools.repair_publication, undefined);
  assert.ok(f.tools.edit_page);
  assert.doesNotMatch(f.instructions, /Reparo disponível: repair_publication/);
  assert.match(
    f.instructions,
    /cta\.band aceita layout cover com image e imageAlt obrigatórios/,
  );
  assert.match(
    f.instructions,
    /não houver foto disponível, explique a limitação e ofereça uma alternativa que o sistema realmente aplica/,
  );
});

await test('pedido real liga o card da home à página criada sem trocar a seção', async () => {
  const pages = editPages();
  pages[1].slug = 'padaria-e-confeitaria';
  pages[1].title = 'Padaria e Confeitaria';
  pages[0].blocks.splice(4, 0, {
    id: 'produtos',
    type: 'feature.bento',
    props: {
      title: 'Produtos da loja',
      items: [
        {
          title: 'Padaria e Confeitaria',
          body: 'Pães frescos, bolos e fornadas ao longo do dia.',
        },
        {
          title: 'Hortifruti',
          body: 'Frutas, verduras e legumes selecionados.',
        },
      ],
    },
  });
  const text =
    'adicionar navegacao para pagina padaria na pagina inicial nos itens de padaria como card';
  const f = await pageEditFixture(text, { initialPages: pages });
  const result = await f.tools.edit_page.execute(
    input(f.pages[0], [
      {
        op: 'set',
        block: 'produtos',
        path: 'items.0.href',
        value: '/padaria-e-confeitaria',
      },
    ]),
  );
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(
    f.pages[0].blocks.find((block) => block.id === 'produtos').props.items[0]
      .href,
    '/padaria-e-confeitaria',
  );
  assert.deepEqual(result.summary, [
    'Em “Produtos da loja”: navegação do card atualizada.',
  ]);
  assert.equal(f.tools.repair_publication, undefined);
  assert.equal(f.writes.length, 1);
  assert.match(f.instructions, /feature\.bento aceita href em cada item/);
});

await test('pedido real remove a parte indicada e aplica destaque integral com masonry', async () => {
  const pages = editPages();
  pages[0].blocks.splice(4, 0, {
    id: 'variedade',
    type: 'feature.bento',
    props: {
      title: 'Variedade para o seu lar',
      layout: 'mosaic',
      items: [
        {
          title: 'Seleção diária de hortifrúti fresco',
          body: 'Frutas, verduras e legumes selecionados todos os dias.',
          image: 'https://assets.test/hortifruti.svg',
          imageAlt: 'Seleção de frutas e verduras frescas',
        },
        {
          title: 'Parte indicada no anexo',
          body: 'Conteúdo visual que o operador pediu para retirar.',
        },
        {
          title: 'Padaria',
          body: 'Pães e bolos preparados para diferentes momentos.',
        },
        {
          title: 'Mercearia',
          body: 'Itens essenciais para completar as compras da casa.',
        },
      ],
    },
  });
  const text =
    'no bloco "Variedade para o seu lar", quero que remova essa parte que anexei como referencia, o bloco "Seleção diária de hortifrúti fresco" deve pegar 100% do width do container e os itens devem estar alinhados em mansory logo abaixo.';
  const f = await pageEditFixture(text, { initialPages: pages });
  const result = await f.tools.edit_page.execute(
    input(f.pages[0], [
      {
        op: 'remove_item',
        block: 'variedade',
        path: 'items',
        index: 1,
      },
      {
        op: 'set',
        block: 'variedade',
        path: 'layout',
        value: 'featured-masonry',
      },
    ]),
  );
  assert.equal(result.ok, true, JSON.stringify(result));
  const block = f.pages[0].blocks.find((item) => item.id === 'variedade');
  assert.equal(block.props.layout, 'featured-masonry');
  assert.deepEqual(
    block.props.items.map((item) => item.title),
    ['Seleção diária de hortifrúti fresco', 'Padaria', 'Mercearia'],
  );
  assert.deepEqual(result.summary, [
    'Em “Variedade para o seu lar”: item indicado removido.',
    'Em “Variedade para o seu lar”: primeiro card em largura total e demais em masonry.',
  ]);
  assert.equal(f.tools.repair_publication, undefined);
  assert.equal(f.writes.length, 1);
  assert.match(f.instructions, /feature\.bento aceita layout featured-masonry/);
  // A mesma orientação precisa valer quando a seção de cards já é a
  // composição de assinatura, como na home que motivou o caso.
  assert.match(
    f.instructions,
    /signature\.composition aceita arrangement focus-full/,
  );
  assert.match(f.instructions, /Não troque o tipo do bloco para obter o arranjo/);
});

await test('remove_item exige que o pedido atual autorize remoção', async () => {
  const pages = editPages();
  pages[0].blocks.splice(4, 0, {
    id: 'variedade',
    type: 'feature.bento',
    props: {
      title: 'Variedade para o seu lar',
      items: [
        { title: 'Hortifrúti', body: 'Seleção fresca para a casa.' },
        { title: 'Padaria', body: 'Pães e bolos preparados no dia.' },
      ],
    },
  });
  const f = await pageEditFixture('organize os cards', { initialPages: pages });
  const result = await f.tools.edit_page.execute(
    input(f.pages[0], [
      {
        op: 'remove_item',
        block: 'variedade',
        path: 'items',
        index: 1,
      },
    ]),
  );
  assert.match(result.error, /não autoriza remover itens/);
  assert.equal(f.writes.length, 0);
});

await test('troca de tipo preserva ID e recusa um schema incompleto sem remover o original', async () => {
  const f = await pageEditFixture();
  const original = structuredClone(f.pages[0].blocks[1]);
  const result = await f.tools.edit_page.execute(
    input(f.pages[0], [
      {
        op: 'replace_block',
        block: 'hero',
        replacement: { type: 'hero.split', props: original.props },
      },
    ]),
  );
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(f.pages[0].blocks[1].id, 'hero');
  assert.equal(f.pages[0].blocks[1].type, 'hero.split');
  assert.deepEqual(f.pages[0].blocks[1].props, original.props);
  const next = structuredClone(f.pages);
  const invalid = await f.tools.edit_page.execute(
    input(f.pages[0], [
      {
        op: 'replace_block',
        block: 'hero',
        replacement: { type: 'hero.statement', props: {} },
      },
    ]),
  );
  assert.ok(invalid.error);
  assert.deepEqual(f.pages, next);
});

await test('texto em listas de strings e rodapé preserva destinos e entrada do lote', () => {
  const page = editPages()[0];
  page.blocks[5].props.tagline = 'Cuidados antes da escolha';
  page.blocks.splice(2, 0, {
    id: 'logos',
    type: 'proof.logos',
    props: { logos: ['Marca A', 'Marca B', 'Marca C'] },
  });
  const request = input(page, [
    { op: 'replace_text', from: 'Marca B', to: 'Marca D' },
    {
      op: 'replace_text',
      from: 'Cuidados antes da escolha',
      to: 'Orientações sobre materiais',
    },
  ]);
  const original = structuredClone(request);
  const edited = applyPageEdit(page, request);
  assert.deepEqual(edited.blocks[2].props.logos, [
    'Marca A',
    'Marca D',
    'Marca C',
  ]);
  assert.equal(
    edited.blocks.at(-1).props.tagline,
    'Orientações sobre materiais',
  );
  assert.deepEqual(request, original);
});

await test('troca literal ambígua não permite ao modelo escolher IDs nem dividir em duas operações', async () => {
  for (const operations of [
    [
      {
        op: 'replace_text',
        block: 'nav',
        from: 'Ver materiais',
        to: 'Ver opções',
      },
      {
        op: 'replace_text',
        block: 'cta',
        from: 'Ver materiais',
        to: 'Ver opções',
      },
    ],
    [{ op: 'set', block: 'nav', path: 'links.0.label', value: 'Ver opções' }],
  ]) {
    const f = await pageEditFixture('Troque "Ver materiais" por "Ver opções".');
    const result = await f.tools.edit_page.execute(
      input(f.pages[0], operations),
    );
    assert.match(result.error, /aparece 2 vezes/);
    assert.equal(f.writes.length, 0);
    assert.deepEqual(f.pages, editPages());
  }
});

await test('texto padrão do render pode ser alterado sem persistir outros defaults ou nomes técnicos', () => {
  const page = editPages()[0];
  const form = {
    id: 'form',
    type: 'form.lead',
    props: {
      title: 'Envie sua mensagem',
      fields: [{ name: 'email', type: 'email', label: 'Seu email' }],
    },
  };
  page.blocks.push(form);
  const edited = applyPageEdit(
    page,
    input(page, [
      {
        op: 'replace_text',
        from: 'Enviar',
        to: 'Enviar mensagem',
        block: 'form',
      },
    ]),
  );
  assert.deepEqual(edited.blocks.at(-1).props, {
    ...form.props,
    submitLabel: 'Enviar mensagem',
  });
  const addressed = applyPageEdit(
    page,
    input(page, [
      { op: 'replace_text', from: 'email', to: 'contato', block: 'form' },
    ]),
  );
  assert.equal(addressed.blocks.at(-1).props.fields[0].label, 'Seu contato');
  assert.equal(addressed.blocks.at(-1).props.fields[0].name, 'email');
  assert.equal(addressed.blocks.at(-1).props.fields[0].type, 'email');
});

function carouselPage() {
  const page = editPages()[0];
  page.blocks[1] = {
    id: 'hero',
    type: 'hero.landing',
    props: {
      layout: 'stage',
      headline: 'Materiais para cada ambiente',
      subtext: 'Considere o uso e as referências do projeto antes da escolha.',
      cta: { label: 'Conferir opções', href: '/materiais' },
      image: 'https://assets.test/foto-4.webp',
      imageAlt: 'Material principal aplicado em uma bancada clara',
      imagePresentation: { frame: 'none', fit: 'contain' },
    },
  };
  return page;
}

const carouselSlides = [
  {
    src: 'https://assets.test/foto-6.webp',
    alt: 'Detalhe lateral do material aplicado',
  },
  {
    src: 'https://assets.test/foto-7.webp',
    alt: 'Acabamento do material visto de perto',
    caption: 'Detalhe do acabamento',
  },
  {
    src: 'https://assets.test/foto-8.webp',
    alt: 'Material em outro ambiente iluminado',
  },
];

await test('set slides preserva a primeira foto e entrega recibo determinístico', () => {
  const page = carouselPage();
  const before = structuredClone(page.blocks[1].props);
  const request = input(page, [
    { op: 'set', block: 'hero', path: 'slides', value: carouselSlides },
  ]);
  const edited = applyPageEdit(
    page,
    request,
    editPolicyFor(
      'No lugar de apenas uma imagem no hero, quero um carrossel com as imagens #4, #6, #7 e #8.',
      [page],
    ),
  );
  const hero = edited.blocks.find((block) => block.id === 'hero');
  assert.equal(hero.props.image, before.image);
  assert.equal(hero.props.headline, before.headline);
  assert.deepEqual(hero.props.imagePresentation, before.imagePresentation);
  assert.deepEqual(hero.props.slides, carouselSlides);
  assert.deepEqual(edited.summary, ['Em “abertura”: carrossel com 4 fotos.']);

  const receipt = createEditReceipt();
  receipt.observe(
    'edit_page',
    { page: '' },
    {
      ok: true,
      changed: true,
      summary: edited.summary,
    },
  );
  assert.match(receipt.text(), /carrossel com 4 fotos/);
});

await test('remover slide exige pedido de remoção e escopo visual aceita a mídia no bloco nomeado', () => {
  const page = carouselPage();
  page.blocks[1].props.slides = structuredClone(carouselSlides);
  assert.throws(
    () =>
      applyPageEdit(
        page,
        input(page, [
          {
            op: 'set',
            block: 'hero',
            path: 'slides',
            value: carouselSlides.slice(0, 2),
          },
        ]),
        editPolicyFor('Ajuste o carrossel do hero.', [page]),
      ),
    /apagaria conteúdo/,
  );

  const clean = carouselPage();
  const visual = editPolicyFor(
    'No bloco “hero”, quero um carrossel de fotos.',
    [clean],
  );
  assert.equal(visual.visualOnly, true);
  const edited = applyPageEdit(
    clean,
    input(clean, [
      { op: 'set', block: 'hero', path: 'slides', value: carouselSlides },
      {
        op: 'set',
        block: 'hero',
        path: 'carousel.autoplay',
        value: false,
      },
    ]),
    visual,
  );
  assert.deepEqual(edited.blocks[1].props.slides, carouselSlides);
  assert.equal(edited.blocks[1].props.carousel.autoplay, false);
});
