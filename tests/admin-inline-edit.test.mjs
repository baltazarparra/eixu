import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
import { pageEditFixture, editPages } from './helpers/page-edit-fixture.mjs';
import { loadModule } from './helpers/load-module.mjs';
const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
const { pageRevision } = await j.import('../lib/ai/page-edits.ts');
async function fixture(options = {}) {
  const f = await pageEditFixture(undefined, options);
  const { POST } = await loadModule('app/api/admin/[tenant]/edit/route.ts', {
    ...f.mocks,
    '@/lib/auth': { isAuthenticated: async () => options.auth !== false },
    '@/lib/tenant-queries': {
      ...f.mocks['@/lib/tenant-queries'],
      getTenantBySlug: async (slug) =>
        slug === f.tenant.slug ? f.tenant : null,
    },
  });
  return {
    ...f,
    call: (patch = {}, init = {}) =>
      POST(
        new Request('http://localhost/api/admin/edit-fixture/edit', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...init.headers },
          body: JSON.stringify({
            page: '',
            revision: pageRevision(f.pages[0]),
            blocks: [{ id: 'intro', text: { title: 'Texto revisado' } }],
            ...patch,
          }),
        }),
        { params: Promise.resolve({ tenant: init.tenant ?? f.tenant.slug }) },
      ),
  };
}
await test('rota administrativa exige sessão, origem e tenant resolvido no servidor', async () => {
  const noAuth = await fixture({ auth: false });
  assert.equal((await noAuth.call()).status, 401);
  assert.equal(noAuth.writes.length, 0);
  const f = await fixture();
  assert.equal(
    (await f.call({}, { headers: { origin: 'https://foreign.test' } })).status,
    403,
  );
  assert.equal((await f.call({}, { tenant: 'other' })).status, 404);
  assert.equal((await f.call({ page: 'other' })).status, 404);
  assert.equal(
    (
      await f.call({
        blocks: [{ id: 'intro', text: { title: 'Novo' }, tenantId: 'other' }],
      })
    ).status,
    400,
  );
  assert.equal(f.writes.length, 0);
});
await test('rota salva texto e estilo no rascunho, mantendo snapshot e outra página', async () => {
  const f = await fixture();
  const before = structuredClone(f.pages);
  const response = await f.call({
    blocks: [
      {
        id: 'intro',
        text: {
          title: 'Texto revisado',
          body: 'Compare as opções conforme o uso e as referências do ambiente.',
        },
        textStyles: [{ field: 'title', size: 1 }],
      },
      { id: 'faq', text: { 'items.1.q': 'Como cuidar dos acabamentos?' } },
    ],
  });
  assert.equal(response.status, 200);
  const receipt = await response.json();
  assert.equal(receipt.ok, true);
  assert.equal(receipt.changed, true);
  assert.equal(receipt.saved, 'draft');
  assert.equal(receipt.changes.length, 4);
  assert.equal(f.writes.length, 1);
  assert.equal(f.pages[0].blocks[2].props.title, 'Texto revisado');
  assert.deepEqual(f.pages[0].publishedBlocks, before[0].publishedBlocks);
  assert.deepEqual(f.pages[1], before[1]);
  const noOp = await f.call();
  assert.equal((await noOp.json()).changed, false);
  assert.equal(f.writes.length, 1);
});
await test('rota recusa campos privados, conteúdo inválido e estilo sem salvar parcialmente', async () => {
  for (const patch of [
    { text: { title: '' } },
    { text: { title: 'x'.repeat(100) } },
    { text: { 'presentation.background': '#000000' } },
    { text: { 'items.100.title': 'Outra coisa' } },
    { textStyles: [{ field: 'body', size: -2 }] },
    { textStyles: [{ field: 'title', color: '#14161a' }] },
  ]) {
    const f = await fixture();
    const response = await f.call({
      blocks: [
        { id: 'hero', text: { headline: 'Título válido do ambiente' } },
        { id: 'intro', ...patch },
      ],
    });
    assert.equal(response.status, 422, JSON.stringify(patch));
    const body = await response.json();
    assert.ok(body.error);
    assert.ok(body.fields.length, JSON.stringify(body));
    assert.equal(f.writes.length, 0);
    assert.deepEqual(f.pages, editPages());
  }
  const f = await fixture();
  assert.equal(
    (
      await f.call({
        blocks: [{ id: 'hero', textStyles: [{ field: 'cta.label', size: 1 }] }],
      })
    ).status,
    422,
  );
});
await test('revisão antiga e concorrência retornam 409 e conservam a edição mais recente', async () => {
  const f = await fixture();
  assert.equal((await f.call({ revision: 'a'.repeat(64) })).status, 409);
  assert.equal(f.writes.length, 0);
  const race = await fixture({
    race: (page) => {
      page.blocks[2].props.title = 'Outra aba';
    },
  });
  assert.equal((await race.call()).status, 409);
  assert.equal(race.pages[0].blocks[2].props.title, 'Outra aba');
  assert.equal(race.writes.length, 0);
});
await test('catálogo de texto não deixa estilos atingirem URLs e a remoção restaura o estilo original', async () => {
  const f = await fixture();
  f.pages[0].blocks[2].props.textStyles = [{ field: 'title', size: 1 }];
  assert.equal(
    (await f.call({ blocks: [{ id: 'intro', textStyles: [] }] })).status,
    200,
  );
  assert.equal(f.pages[0].blocks[2].props.textStyles, undefined);
  assert.equal(
    (
      await f.call({
        blocks: [
          { id: 'nav', text: { 'links.0.href': 'https://foreign.test' } },
        ],
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await f.call({
        blocks: [{ id: 'nav', text: { '__proto__.x': 'value' } }],
      })
    ).status,
    400,
  );
});
