import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
import { pageEditFixture } from './helpers/page-edit-fixture.mjs';

const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
const { pageRevision } = await j.import('../lib/ai/page-edits.ts');
const { isUndoRequest, isAffirmative } = await j.import(
  '../lib/ai/chat-progress.ts',
);

await test('reconhece o pedido curto de reverter e a confirmação', () => {
  for (const text of [
    'desfaz',
    'Desfaça',
    'reverte isso',
    'volta como estava',
    'pode desfazer a última alteração',
  ])
    assert.equal(isUndoRequest(text), true, text);
  assert.equal(isUndoRequest('remove esse bloco em anexo'), false);
  assert.equal(isUndoRequest('refaz a home inteira'), false);
  assert.equal(isAffirmative('sim, pode remover'), true);
  assert.equal(isAffirmative('não'), false);
  assert.equal(isAffirmative('remove tudo mesmo assim'), false);
});

await test('o desfazer devolve os mesmos blocos, IDs e posições', async () => {
  const fixture = await pageEditFixture('remova a seção inteira de dúvidas');
  const [home] = fixture.pages;
  const before = structuredClone(home.blocks);
  const removed = await fixture.tools.edit_page.execute({
    page: '',
    revision: pageRevision(home),
    operations: [{ op: 'remove', block: 'faq' }],
  });
  assert.equal(removed.ok, true);
  assert.equal(removed.undoAvailable, true);
  assert.match(removed.summary.join(' '), /seção removida, com 2 itens/);
  assert.equal(home.blocks.length, before.length - 1);

  const undone = await fixture.tools.undo_page_edit.execute({ page: '' });
  assert.equal(undone.ok, true);
  assert.deepEqual(home.blocks, before);
  assert.equal(pageRevision(home), pageRevision({ blocks: before }));
});

await test('desfazer duas vezes volta ao estado desfeito, sem recriar conteúdo', async () => {
  const fixture = await pageEditFixture('remova a seção inteira de dúvidas');
  const [home] = fixture.pages;
  const before = structuredClone(home.blocks);
  await fixture.tools.edit_page.execute({
    page: '',
    revision: pageRevision(home),
    operations: [{ op: 'remove', block: 'faq' }],
  });
  const afterRemoval = structuredClone(home.blocks);
  await fixture.tools.undo_page_edit.execute({ page: '' });
  assert.deepEqual(home.blocks, before);
  const again = await fixture.tools.undo_page_edit.execute({ page: '' });
  assert.equal(again.ok, true);
  assert.deepEqual(home.blocks, afterRemoval);
});

await test('sem versão guardada, o desfazer explica em vez de inventar', async () => {
  const fixture = await pageEditFixture('desfaz');
  const result = await fixture.tools.undo_page_edit.execute({ page: '' });
  assert.match(result.error, /Não há alteração anterior guardada/);
  assert.equal(fixture.pages[0].blocks.length, 6);
});
