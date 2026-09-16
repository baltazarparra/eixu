import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers/load-module.mjs';

async function fixture(
  status,
  { maintenanceMode = 'generator', update = true } = {},
) {
  const writes = [];
  const refreshed = [];
  const { deleteTenantAction, setTenantArchivedAction } = await loadModule(
    'app/(admin)/admin/actions.ts',
    {
      '@/lib/auth': {
        currentUser: async () => ({
          id: 'user-1',
          name: 'Operador',
          login: 'operador@eixu',
        }),
      },
      '@/lib/admin/activity': { recordActivity: async () => undefined },
      '@/lib/tenant-queries': {
        getTenantBySlug: async () => ({
          id: 'tenant-1',
          slug: 'fixture',
          name: 'Fixture',
          maintenanceMode,
        }),
      },
      '@/lib/db': {
        db:
          () =>
          async (parts, ...values) => {
            writes.push({ sql: parts.join('?'), values });
            return update ? [{ name: 'Fixture', status }] : [];
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
  return { deleteTenantAction, setTenantArchivedAction, writes, refreshed };
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

await test('projeto Premium não promete arquivamento que deixaria o domínio no ar', async () => {
  const f = await fixture('published', {
    maintenanceMode: 'premium',
    update: false,
  });
  const result = await f.setTenantArchivedAction(null, form('archive'));
  assert.equal(result.ok, false);
  assert.match(result.message, /Premium/);
  assert.equal(f.writes.length, 1);
  assert.match(f.writes[0].sql, /maintenance_mode = 'generator'/);
});

await test('projeto Premium bloqueia exclusão antes de remover arquivos', async () => {
  const f = await fixture('published', { maintenanceMode: 'premium' });
  const result = await f.deleteTenantAction(null, form('archive'));
  assert.equal(result.ok, false);
  assert.match(result.message, /domínio.*releases/i);
  assert.equal(f.writes.length, 0);
});
