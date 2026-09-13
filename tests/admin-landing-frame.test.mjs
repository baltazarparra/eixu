import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
import {
  landingFrameFixture,
  landingFrameOperations,
  landingFrameRequest,
} from './helpers/landing-frame-fixture.mjs';

const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
const { pageRevision, editingPageContext } = await j.import(
  '../lib/ai/page-edits.ts',
);
const { asksRemoval } = await j.import('../lib/ai/edit-policy.ts');

for (const layout of ['stage', 'form'])
  await test(`pedido de retirar o container da imagem funciona no hero ${layout} sem recompor`, async () => {
    const f = await landingFrameFixture(layout);
    const expected = structuredClone(f.pages);
    assert.match(editingPageContext(f.pages[0]), /imagePresentation/);
    const result = await f.tools.edit_page.execute({
      page: '',
      revision: pageRevision(f.pages[0]),
      operations: landingFrameOperations,
    });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(f.writes.length, 1);
    expected[0].blocks.find((b) => b.id === 'hero').props.imagePresentation = {
      frame: 'none',
      fit: 'natural',
    };
    assert.deepEqual(f.pages, expected);
    assert.match(result.summary.join(' '), /moldura da imagem removida/);
    const restored = await f.tools.edit_page.execute({
      page: '',
      revision: pageRevision(f.pages[0]),
      operations: [{ op: 'unset', block: 'hero', path: 'imagePresentation' }],
    });
    assert.equal(restored.ok, true, JSON.stringify(restored));
    delete expected[0].blocks.find((b) => b.id === 'hero').props
      .imagePresentation;
    assert.deepEqual(f.pages, expected);
  });

await test('remover container deixando a imagem não autoriza apagar o conteúdo', async () => {
  assert.equal(asksRemoval(landingFrameRequest), false);
  assert.equal(asksRemoval('Retire essa moldura da foto'), false);
  assert.equal(asksRemoval('Remova o bloco de texto'), true);
  assert.equal(
    asksRemoval(`${landingFrameRequest} Apague também o título.`),
    true,
  );
  for (const operation of [
    { op: 'remove', block: 'hero' },
    { op: 'unset', block: 'hero', path: 'subtext' },
    { op: 'set', block: 'hero', path: 'badges', value: [] },
  ]) {
    const f = await landingFrameFixture();
    const before = structuredClone(f.pages);
    const result = await f.tools.edit_page.execute({
      page: '',
      revision: pageRevision(f.pages[0]),
      operations: [...landingFrameOperations, operation],
    });
    assert.ok(result.error, JSON.stringify(operation));
    assert.equal(f.writes.length, 0);
    assert.deepEqual(f.pages, before);
  }
});

await test('controle inválido recusa o lote inteiro da edição de imagem', async () => {
  const f = await landingFrameFixture();
  const before = structuredClone(f.pages);
  const result = await f.tools.edit_page.execute({
    page: '',
    revision: pageRevision(f.pages[0]),
    operations: [
      ...landingFrameOperations,
      {
        op: 'set',
        block: 'hero',
        path: 'imagePresentation.position',
        value: 'fixed',
      },
    ],
  });
  assert.ok(result.error);
  assert.equal(f.writes.length, 0);
  assert.deepEqual(f.pages, before);
});
