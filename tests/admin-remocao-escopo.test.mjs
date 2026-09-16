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
const { applyPageEdit, pageRevision, BlockRemovalConfirmationError } =
  await j.import('../lib/ai/page-edits.ts');
const { editPolicyFor, removalScope } = await j.import(
  '../lib/ai/edit-policy.ts',
);
const { resolveAnchor, anchorContext } = await j.import('../lib/ai/anchor.ts');

const input = (page, operations) => ({
  page: page.slug,
  revision: pageRevision(page),
  operations,
});

/**
 * O pedido do incidente: o operador chamou de "bloco" o card que marcou numa
 * imagem, e a seção inteira foi apagada.
 */
const POINTED = 'remove esse bloco em anexo de referencia da pagina inicial';

await test('o tamanho da remoção sai do pedido, não de um único bit', () => {
  assert.equal(removalScope('remova esse card do bloco Variedade'), 'item');
  assert.equal(
    removalScope('remova esse card da seção e mantenha todos os outros'),
    'item',
  );
  assert.equal(removalScope('remova todos os cards da seção'), 'item');
  assert.equal(
    removalScope('remova o bloco inteiro com todos os cards'),
    'block',
  );
  assert.equal(removalScope('remova essa parte que anexei'), 'item');
  assert.equal(removalScope('apague a foto do segundo item'), 'item');
  assert.equal(removalScope(POINTED), undefined);
  assert.equal(removalScope('remova o bloco inteiro'), 'block');
  assert.equal(removalScope('apague a seção de dúvidas'), 'block');
  assert.equal(removalScope('remova uma das seções inteiras'), 'block');
  assert.equal(removalScope('remova a sessão com a foto gigante'), 'block');
  assert.equal(
    removalScope(
      'Troque Pedir horário e tire aquela sessão com uma foto gigante.',
    ),
    'block',
  );
  assert.equal(
    removalScope(
      'Remova a seção inteira do formulário e coloque o botão de WhatsApp no agendamento.',
    ),
    'block',
  );
  assert.equal(
    removalScope('Tem uma seção com uma foto gigante. Apague-a.'),
    'block',
  );
  assert.equal(removalScope('troque o título da home'), undefined);
});

await test('formulário e agendamento por WhatsApp são gravados no mesmo lote', async () => {
  const [page] = editPages();
  page.blocks.splice(4, 0, {
    id: 'formulario',
    type: 'form.lead',
    props: {
      title: 'Peça seu horário',
      body: 'Conte como prefere entrar em contato para combinar um horário.',
      fields: [
        { name: 'nome', label: 'Nome', type: 'text', required: true },
        { name: 'email', label: 'E-mail', type: 'email', required: true },
        { name: 'mensagem', label: 'Mensagem', type: 'textarea' },
      ],
    },
  });
  const published = structuredClone(page.publishedBlocks);
  const fixture = await pageEditFixture(
    'Remova a seção inteira do formulário e coloque o botão de WhatsApp no agendamento.',
    {
      initialPages: [page],
      initialTenant: { ...editTenant, whatsapp: '5514920045160' },
    },
  );
  const result = await fixture.tools.edit_page.execute({
    page: '',
    revision: pageRevision(fixture.pages[0]),
    operations: [
      { op: 'remove', block: 'formulario' },
      { op: 'set', block: 'cta', path: 'cta.label', value: 'Agendar horário' },
      { op: 'set', block: 'cta', path: 'cta.href', value: '/go/wa?from=/' },
    ],
  });
  assert.equal(result.ok, true, result.error);
  assert.equal(fixture.writes.length, 1);
  assert.equal(
    fixture.pages[0].blocks.some((block) => block.id === 'formulario'),
    false,
  );
  assert.equal(
    fixture.pages[0].blocks.find((block) => block.id === 'cta').props.cta.href,
    '/go/wa?from=/',
  );
  assert.deepEqual(fixture.pages[0].publishedBlocks, published);
});

await test('remover uma seção não libera apagar texto em outro bloco', () => {
  const [page] = editPages();
  page.blocks.splice(4, 0, {
    id: 'formulario',
    type: 'form.lead',
    props: {
      title: 'Peça seu horário',
      fields: [{ name: 'nome', label: 'Nome', type: 'text' }],
    },
  });
  const policy = editPolicyFor(
    'Remova a seção inteira do formulário e coloque o WhatsApp no agendamento.',
    [page],
    '',
  );
  assert.throws(
    () =>
      applyPageEdit(
        page,
        input(page, [
          { op: 'remove', block: 'formulario' },
          { op: 'unset', block: 'hero', path: 'subtext' },
        ]),
        policy,
      ),
    /remoção pedida não autoriza apagar outros textos/,
  );
  assert.equal(
    page.blocks.some((block) => block.id === 'formulario'),
    true,
  );
});

await test('apagar a seção inteira é recusado quando o pedido aponta um item', () => {
  const [page] = editPages();
  const policy = editPolicyFor(POINTED, editPages(), '');
  assert.equal(policy.removal, true);
  assert.equal(policy.removalScope, undefined);
  assert.throws(
    () =>
      applyPageEdit(
        page,
        input(page, [{ op: 'remove', block: 'faq' }]),
        policy,
      ),
    (error) => {
      assert.match(error.message, /seção inteira/);
      assert.match(error.message, /2 itens/);
      assert.ok(error instanceof BlockRemovalConfirmationError);
      assert.equal(error.blockId, 'faq');
      return true;
    },
  );
  // Nada foi alterado no plano recusado.
  assert.equal(page.blocks.length, 6);
});

await test('preservar os outros cards não amplia a remoção para a seção', () => {
  const [page] = editPages();
  const policy = editPolicyFor(
    'remova esse card da seção e mantenha todos os outros',
    [page],
    '',
  );
  assert.equal(policy.removalScope, 'item');
  assert.throws(
    () =>
      applyPageEdit(
        page,
        input(page, [{ op: 'remove', block: 'faq' }]),
        policy,
      ),
    /seção inteira/,
  );
  assert.equal(page.blocks.length, 6);
});

await test('replace_block não contorna uma remoção limitada ao item', () => {
  const [page] = editPages();
  const policy = editPolicyFor('remova esse card da seção', [page], '');
  assert.equal(policy.removalScope, 'item');
  assert.throws(
    () =>
      applyPageEdit(
        page,
        input(page, [
          {
            op: 'replace_block',
            block: 'faq',
            replacement: {
              type: 'editorial.text',
              props: {
                title: 'Seção substituída',
                body: 'Esta troca eliminaria todas as perguntas da seção.',
              },
            },
          },
        ]),
        policy,
      ),
    /seção inteira/,
  );
  assert.equal(
    page.blocks.find((block) => block.id === 'faq')?.type,
    'faq.accordion',
  );
});

/** Seção de cards como a que o operador apontou: quatro itens em uma lista. */
function pageWithCards() {
  const [page] = editPages();
  page.blocks.splice(3, 0, {
    id: 'cards',
    type: 'feature.bento',
    props: {
      title: 'Variedade para o seu lar',
      items: [
        {
          title: 'Hortifrúti',
          body: 'Frutas e verduras repostas todos os dias.',
        },
        { title: 'Açougue', body: 'Cortes selecionados no balcão da loja.' },
        {
          title: 'Mercearia',
          body: 'Itens essenciais com preço para a semana.',
        },
        { title: 'Ofertas', body: 'Campanhas com dias especiais de economia.' },
      ],
    },
  });
  return page;
}

await test('o item indicado sai sem levar a seção junto', () => {
  const page = pageWithCards();
  const policy = editPolicyFor('remova esse card em anexo', editPages(), '');
  const edited = applyPageEdit(
    page,
    input(page, [
      { op: 'remove_item', block: 'cards', path: 'items', index: 3 },
    ]),
    policy,
  );
  const cards = edited.blocks.find((block) => block.id === 'cards');
  assert.equal(cards.props.items.length, 3);
  assert.equal(cards.props.items.at(-1).title, 'Mercearia');
  assert.equal(edited.blocks.length, 7);
});

await test('remove_item não autoriza perder texto de outro card na própria seção', () => {
  const page = pageWithCards();
  const policy = editPolicyFor('remova o card Ofertas', [page], '');
  assert.throws(
    () =>
      applyPageEdit(
        page,
        input(page, [
          { op: 'remove_item', block: 'cards', path: 'items', index: 3 },
          { op: 'set', block: 'cards', path: 'items.2.body', value: '' },
        ]),
        policy,
      ),
    /remoção pedida não autoriza apagar outros textos/,
  );
  assert.equal(
    page.blocks.find((block) => block.id === 'cards').props.items.length,
    4,
  );
});

await test('o mínimo do schema recusa o item e não vira remoção da seção', () => {
  const [page] = editPages();
  const policy = editPolicyFor(
    'remova essa pergunta em anexo',
    editPages(),
    '',
  );
  // O bloco de dúvidas exige duas perguntas: tirar uma é recusado pelo schema.
  assert.throws(
    () =>
      applyPageEdit(
        page,
        input(page, [
          { op: 'remove_item', block: 'faq', path: 'items', index: 1 },
        ]),
        policy,
      ),
    /Bloco faq inválido/,
  );
  // E a saída destrutiva continua fechada pelo mesmo pedido.
  assert.throws(
    () =>
      applyPageEdit(
        page,
        input(page, [{ op: 'remove', block: 'faq' }]),
        policy,
      ),
    /seção inteira/,
  );
  assert.equal(page.blocks.length, 6);
});

await test('a confirmação do operador libera a remoção da seção', () => {
  const [page] = editPages();
  const policy = editPolicyFor('sim, pode remover', editPages(), '', {
    confirmedBlockRemoval: true,
  });
  assert.equal(policy.removalScope, 'block');
  const edited = applyPageEdit(
    page,
    input(page, [{ op: 'remove', block: 'faq' }]),
    policy,
  );
  assert.equal(edited.blocks.length, 5);
  assert.match(edited.summary.join(' '), /seção removida, com 2 itens/);
});

await test('um lote não apaga duas seções de uma vez', () => {
  const [page] = editPages();
  const policy = editPolicyFor('remova a seção inteira', editPages(), '');
  assert.throws(
    () =>
      applyPageEdit(
        page,
        input(page, [
          { op: 'remove', block: 'faq' },
          { op: 'remove', block: 'intro' },
        ]),
        policy,
      ),
    /já remove uma seção/,
  );
});

await test('o alvo apontado na prévia vira bloco e índice conferidos no conteúdo', () => {
  const [page] = editPages();
  const anchor = resolveAnchor(page, {
    blockId: 'faq',
    text: 'O que observar no projeto? Observe as dimensões, a iluminação e as referências de acabamento.',
    label: 'O que observar no projeto?',
  });
  assert.equal(anchor.blockId, 'faq');
  assert.equal(anchor.path, 'items');
  assert.equal(anchor.index, 1);
  assert.match(anchorContext(anchor), /remove_item/);
  // Texto que não existe no bloco não inventa índice.
  const vague = resolveAnchor(page, {
    blockId: 'faq',
    text: 'Dúvidas sobre materiais',
    label: 'Dúvidas sobre materiais',
  });
  assert.equal(vague.index, undefined);
  assert.match(anchorContext(vague), /confirme antes de qualquer remoção/);
});

const photos = [1, 2].map((seq) => ({
  id: `img-${seq}`,
  seq,
  url: `https://assets.test/cena-${seq}.webp`,
  kind: 'foto',
  model: 'openai/gpt-image-2',
  blobPath: `tenants/sample/gerado/batch/${seq}.webp`,
  status: 'aprovada',
  targetBlock: null,
  requestText: `Cena ${seq}`,
  alt: null,
  score: null,
  critique: {},
  createdAt: '2026-09-01T10:00:00.000Z',
}));

/** Home com a seção protagonista: duas fotos do acervo no mesmo bloco. */
function homeWithProtagonist() {
  const page = pageWithCards();
  const cards = page.blocks.find((block) => block.id === 'cards');
  cards.props.items[0].image = photos[0].url;
  cards.props.items[0].imageAlt = 'Bancada de hortifrúti com frutas frescas';
  cards.props.items[1].image = photos[1].url;
  cards.props.items[1].imageAlt = 'Balcão do açougue com cortes selecionados';
  return page;
}

await test('pedido explícito remove a seção mesmo com consequência editorial', async () => {
  const page = homeWithProtagonist();
  const fixture = await pageEditFixture('remova a seção inteira de fotos', {
    initialPages: [page],
    images: photos,
  });
  const result = await fixture.tools.edit_page.execute({
    page: '',
    revision: pageRevision(fixture.pages[0]),
    operations: [{ op: 'remove', block: 'cards' }],
  });
  assert.equal(result.ok, true, result.error);
  assert.equal(fixture.writes.length, 1);
  assert.equal(
    fixture.pages[0].blocks.some((block) => block.id === 'cards'),
    false,
  );
  assert.deepEqual(fixture.pages[0].publishedBlocks, page.publishedBlocks);
});
