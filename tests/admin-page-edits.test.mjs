import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
import { editPages, pageEditFixture } from './helpers/page-edit-fixture.mjs';
const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
const { applyPageEdit, pageRevision, pageEditSchema } = await j.import(
  '../lib/ai/page-edits.ts',
);
const { editPolicyFor } = await j.import('../lib/ai/edit-policy.ts');
const { sectionColorVars } = await j.import('../lib/blocks/section-colors.ts');
const { contrastRatio } = await j.import('../lib/blocks/contrast.ts');
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
