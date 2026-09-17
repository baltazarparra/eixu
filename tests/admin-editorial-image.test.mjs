import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
import {
  editorialFixture,
  editorialImageOperations,
  editorialImageRequest,
  editorialPages,
} from './helpers/editorial-text-fixture.mjs';

const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
const { pageRevision } = await j.import('../lib/ai/page-edits.ts');
const { editPolicyFor } = await j.import('../lib/ai/edit-policy.ts');
const { interactionModeFor } = await j.import('../lib/ai/interaction.ts');

await test('pedido real adiciona a foto repetida sem CTA, perda de texto ou mudança no publicado', async () => {
  assert.equal(interactionModeFor(editorialImageRequest), 'action');
  assert.notEqual(
    editPolicyFor(editorialImageRequest, editorialPages()).visualOnly,
    true,
  );
  for (const layout of ['lead', 'bridge']) {
    const f = await editorialFixture({ initialPages: editorialPages(layout) });
    const expected = structuredClone(f.pages);
    const revision = pageRevision(f.pages[0]);
    const result = await f.tools.edit_page.execute({
      page: '',
      revision,
      operations: editorialImageOperations,
    });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.match(result.summary.join(' '), /meio a meio entre imagem e texto/);
    assert.equal(f.writes.length, 1);
    const props = expected[0].blocks.find(
      (block) => block.id === 'intro',
    ).props;
    for (const operation of editorialImageOperations)
      props[operation.path] = operation.value;
    assert.deepEqual(f.pages, expected);
    assert.equal(
      f.pages[0].blocks.find((block) => block.id === 'intro').type,
      'editorial.text',
    );
    assert.equal(props.cta, undefined);
    const conflict = await f.tools.edit_page.execute({
      page: '',
      revision,
      operations: editorialImageOperations,
    });
    assert.ok(conflict.error, 'repetir com revisão antiga deve recusar');
    assert.equal(f.writes.length, 1);
    const undo = await f.tools.undo_page_edit.execute({ page: '' });
    assert.equal(undo.ok, true, JSON.stringify(undo));
    assert.deepEqual(f.pages, editorialPages(layout));
  }
});

await test('foto sem descrição, layout incompatível e remoção incidental recusam todo o lote', async () => {
  for (const operations of [
    editorialImageOperations.filter((op) => op.path !== 'imageAlt'),
    editorialImageOperations.filter((op) => op.path !== 'layout'),
    [
      ...editorialImageOperations,
      { op: 'unset', block: 'intro', path: 'body' },
    ],
    [
      ...editorialImageOperations,
      { op: 'unset', block: 'intro', path: 'lead' },
    ],
    [...editorialImageOperations, { op: 'remove', block: 'intro' }],
  ]) {
    const f = await editorialFixture();
    const before = structuredClone(f.pages);
    const result = await f.tools.edit_page.execute({
      page: '',
      revision: pageRevision(f.pages[0]),
      operations,
    });
    assert.ok(result.error, JSON.stringify(result));
    assert.equal(f.writes.length, 0);
    assert.deepEqual(f.pages, before);
  }
});
