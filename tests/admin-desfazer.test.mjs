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

await test('histórico acompanha a ordem de duas edições concorrentes', async () => {
  let releaseFirst;
  let reachedHistory;
  let firstInsert = true;
  const firstAtHistory = new Promise((resolve) => {
    reachedHistory = resolve;
  });
  const holdFirstHistory = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const fixture = await pageEditFixture(undefined, {
    beforeRevisionInsert: async () => {
      if (!firstInsert) return;
      firstInsert = false;
      reachedHistory();
      await holdFirstHistory;
    },
  });
  const edits = fixture.mocks['@/lib/sites/edits'];
  const initial = structuredClone(fixture.pages[0]);
  const firstBlocks = structuredClone(initial.blocks);
  firstBlocks[2].props.title = 'Primeira alteração';
  const firstSave = edits.savePageEdit({
    tenant: fixture.tenant,
    page: initial,
    blocks: firstBlocks,
    brand: fixture.tenant.brand,
  });

  await firstAtHistory;
  const afterFirst = structuredClone(fixture.pages[0]);
  const secondBlocks = structuredClone(afterFirst.blocks);
  secondBlocks[2].props.title = 'Segunda alteração';
  const secondSave = edits.savePageEdit({
    tenant: fixture.tenant,
    page: afterFirst,
    blocks: secondBlocks,
    brand: fixture.tenant.brand,
  });
  releaseFirst();
  const saved = await Promise.all([firstSave, secondSave]);
  assert.equal(
    saved.every((result) => result.undoAvailable),
    true,
  );

  const current = structuredClone(fixture.pages[0]);
  assert.equal(current.blocks[2].props.title, 'Segunda alteração');
  await edits.undoPageEdit({
    tenant: fixture.tenant,
    page: current,
    brand: fixture.tenant.brand,
  });
  assert.equal(fixture.pages[0].blocks[2].props.title, 'Primeira alteração');
});

await test('desfazer resolve a última página alterada, mesmo com outra página em foco', async () => {
  const fixture = await pageEditFixture('ajuste visual na home');
  const edits = fixture.mocks['@/lib/sites/edits'];
  const revisions = fixture.mocks['@/lib/sites/revisions'];
  const homeBefore = structuredClone(fixture.pages[0].blocks);
  const home = structuredClone(fixture.pages[0]);
  const changed = structuredClone(home.blocks);
  changed[1].props.presentation = { textAlign: 'right' };
  await edits.savePageEdit({
    tenant: fixture.tenant,
    page: home,
    blocks: changed,
    brand: fixture.tenant.brand,
  });

  // O painel poderia estar em /materiais; o histórico, não o foco, decide.
  assert.equal(await revisions.latestUndoPage(fixture.tenant.id), '');
  const target = structuredClone(
    fixture.pages.find((page) => page.slug === ''),
  );
  await edits.undoPageEdit({
    tenant: fixture.tenant,
    page: target,
    brand: fixture.tenant.brand,
  });
  assert.deepEqual(fixture.pages[0].blocks, homeBefore);
});

await test('sem versão guardada, o desfazer explica em vez de inventar', async () => {
  const fixture = await pageEditFixture('desfaz');
  const result = await fixture.tools.undo_page_edit.execute({ page: '' });
  assert.match(result.error, /Não há alteração anterior guardada/);
  assert.equal(fixture.pages[0].blocks.length, 6);
});
