import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers/load-module.mjs';

async function fixture(status) {
  const writes = [];
  const refreshed = [];
  const { setTenantArchivedAction } = await loadModule(
    'app/(admin)/admin/actions.ts',
    {
      '@/lib/auth': { isAuthenticated: async () => true },
      '@/lib/db': {
        db:
          () =>
          async (parts, ...values) => {
            writes.push({ sql: parts.join('?'), values });
            return [{ name: 'Fixture', status }];
          },
      },
      'next/cache': { revalidatePath: (path) => refreshed.push(path) },
      'next/navigation': {
        redirect: () => {
          throw new Error('Redirecionamento inesperado');
        },
      },
      'next/server': { after: () => undefined },
    },
  );
  return { setTenantArchivedAction, writes, refreshed };
}

function form(intent, slug = 'fixture') {
  const data = new FormData();
  data.set('slug', slug);
  data.set('intent', intent);
  return data;
}

await test('arquivamento tira a URL do ar sem remover o tenant', async () => {
  const f = await fixture('archived');
  const result = await f.setTenantArchivedAction(null, form('archive'));
  assert.equal(result.ok, true);
  assert.match(result.message, /prévia continua disponível/i);
  assert.match(f.writes[0].sql, /update tenants/i);
  assert.equal(f.writes[0].values[0], true);
  assert.deepEqual(f.refreshed, ['/admin', '/admin/fixture']);
});

await test('reativação recupera o estado calculado pelo conteúdo publicado', async () => {
  const f = await fixture('published');
  const result = await f.setTenantArchivedAction(null, form('restore'));
  assert.equal(result.ok, true);
  assert.match(result.message, /última versão publicada/i);
  assert.equal(f.writes[0].values[0], false);
});

await test('intenção ou endereço inválido não escreve no banco', async () => {
  const f = await fixture('archived');
  assert.equal(
    (await f.setTenantArchivedAction(null, form('remove'))).ok,
    false,
  );
  assert.equal(
    (await f.setTenantArchivedAction(null, form('archive', 'Admin'))).ok,
    false,
  );
  assert.equal(f.writes.length, 0);
});
