import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers/load-module.mjs';

async function fixture({ insert = 'ok', socialFails = false } = {}) {
  const deleted = [],
    inserted = [],
    scheduled = [],
    refreshed = [];
  const logo = 'https://blob.test/tenants/fixture/logo/cadastro.png';
  const { createTenantAction } = await loadModule(
    'app/(admin)/admin/actions.ts',
    {
      '@/lib/auth': { isAuthenticated: async () => true },
      '@/lib/db': {
        db:
          () =>
          async (_parts, ...values) => {
            if (insert === 'error') throw new Error('Insert recusado');
            if (insert === 'duplicate') return [];
            inserted.push(JSON.parse(values.at(-1)));
            return [{ id: 'fixture-id' }];
          },
      },
      '@/lib/blob/tenant-files': { putNewTenantBlob: async () => logo },
      '@vercel/blob': { del: async (url) => deleted.push(url) },
      '@/lib/ai/social': {
        markSocialReading: async () => {
          if (socialFails) throw new Error('Leitura indisponível');
          return { readId: 'reading' };
        },
        syncSocialProfile: async () => {},
      },
      'next/server': { after: (callback) => scheduled.push(callback) },
      'next/cache': { revalidatePath: (path) => refreshed.push(path) },
      'next/navigation': {
        redirect: (path) => {
          throw new Error(`redirect:${path}`);
        },
      },
    },
  );
  const form = new FormData();
  for (const [key, value] of Object.entries({
    name: 'Fixture',
    slug: 'fixture',
    whatsapp: '',
    contactEmail: '',
    socialUrl: 'https://www.instagram.com/fixture/',
    primary: '#112233',
    secondary: '#445566',
    highlight: '#ffffff',
  }))
    form.set(key, value);
  form.set('logo', new File(['synthetic'], 'logo.png', { type: 'image/png' }));
  return {
    run: () => createTenantAction(null, form),
    deleted,
    inserted,
    scheduled,
    refreshed,
    logo,
  };
}

await test('cadastro preserva o logo e abre o editor quando a leitura social falha', async () => {
  const f = await fixture({ socialFails: true });
  await assert.rejects(f.run, /redirect:\/admin\/fixture/);
  assert.equal(f.inserted[0].logoUrl, f.logo);
  assert.equal(f.deleted.length, 0);
  assert.equal(f.scheduled.length, 0);
  assert.deepEqual(f.refreshed, ['/admin']);
});

await test('cadastro agenda a leitura social depois de persistir a marca', async () => {
  const f = await fixture();
  await assert.rejects(f.run, /redirect:\/admin\/fixture/);
  assert.equal(f.inserted.length, 1);
  assert.equal(f.scheduled.length, 1);
  assert.equal(f.deleted.length, 0);
});

for (const insert of ['duplicate', 'error'])
  await test(`cadastro limpa somente o upload de um insert ${insert}`, async () => {
    const f = await fixture({ insert });
    assert.match(
      await f.run(),
      insert === 'duplicate' ? /já pertence/ : /Não foi possível criar/,
    );
    assert.deepEqual(f.deleted, [f.logo]);
    assert.equal(f.inserted.length, 0);
    assert.equal(f.scheduled.length, 0);
  });
