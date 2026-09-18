import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './helpers/load-module.mjs';

const FOLDER_ID = '11111111-1111-4111-8111-111111111111';

async function fixture({ insert = 'ok', direction = 'moderno' } = {}) {
  const inserted = [];
  const deleted = [];
  const refreshed = [];
  const activities = [];
  const logoUrl = 'https://blob.test/tenants/fixture/logo/cadastro.png';
  const { createTenantAction } = await loadModule(
    'app/(admin)/admin/actions.ts',
    {
      '@/lib/auth': {
        currentUser: async () => ({
          id: 'user-1',
          name: 'Operador',
          login: 'operador@eixu',
        }),
      },
      '@/lib/admin/activity': {
        recordActivity: async (activity) => activities.push(activity),
      },
      '@/lib/sites-maintenance': {
        sitesAreInMaintenance: async () => false,
      },
      '@/lib/tenant-queries': {
        siteFolderExists: async (id) => id === FOLDER_ID,
      },
      '@/lib/blob/tenant-files': {
        UploadError: class UploadError extends Error {},
        putNewTenantBlob: async () => logoUrl,
      },
      '@vercel/blob': {
        del: async (url) => deleted.push(url),
      },
      '@/lib/blob/stores.mjs': {
        publicBlobOptions: () => ({ token: 'fixture-public-token' }),
      },
      '@/lib/db': {
        db:
          () =>
          async (parts, ...values) => {
            assert.match(parts.join('?'), /insert into tenants/i);
            if (insert === 'error') throw new Error('insert recusado');
            if (insert === 'duplicate') return [];
            const [
              slug,
              name,
              whatsapp,
              contactEmail,
              brief,
              brand,
              contacts,
              folderId,
            ] = values;
            inserted.push({
              slug,
              name,
              whatsapp,
              contactEmail,
              brief: JSON.parse(brief),
              brand: JSON.parse(brand),
              contacts: JSON.parse(contacts),
              folderId,
            });
            return [{ id: 'tenant-1' }];
          },
      },
      'next/cache': {
        revalidatePath: (path) => refreshed.push(path),
      },
      'next/navigation': {
        redirect: (path) => {
          throw new Error(`redirect:${path}`);
        },
      },
    },
  );

  const form = new FormData();
  for (const [name, value] of Object.entries({
    name: 'Fixture',
    slug: 'fixture',
    contactEmail: 'contato@fixture.com.br',
    story:
      'A Fixture atende projetos de arquitetura desde 2012 e usa materiais naturais em obras residenciais.',
    evidence: 'Fundada em 2012\nAtendimento residencial',
    constraints: 'Não prometer prazo sem confirmação',
    currentSiteUrl: 'https://fixture.example/',
    reference: 'https://referencia.example/',
    primary: '#112233',
    secondary: '#f0f1f2',
    highlight: '#ff5500',
    paletteSource: 'operador',
    direction,
    folderId: FOLDER_ID,
  }))
    form.set(name, value);
  form.append('phone', '11 3333-4444');
  form.append('phoneKind', 'telefone');
  form.append('phone', '+55 11 98888-7777');
  form.append('phoneKind', 'whatsapp');
  form.append('addressLabel', 'Loja');
  form.append('addressText', 'Rua das Pedras, 100, Bauru - SP');
  form.append('social', '@fixture');
  form.set('logo', new File(['logo'], 'logo.png', { type: 'image/png' }));

  return {
    run: () => createTenantAction(null, form),
    inserted,
    deleted,
    refreshed,
    activities,
    logoUrl,
  };
}

void test('cadastro preserva dados, direção visual e organização do cliente', async () => {
  const current = await fixture();
  await assert.rejects(current.run(), /redirect:\/admin\/fixture/);

  assert.equal(current.inserted.length, 1);
  const row = current.inserted[0];
  assert.equal(row.slug, 'fixture');
  assert.equal(row.whatsapp, '5511988887777');
  assert.equal(row.folderId, FOLDER_ID);
  assert.equal(row.brief.intake.currentSiteUrl, 'https://fixture.example/');
  assert.deepEqual(row.brief.intake.references, [
    'https://referencia.example/',
  ]);
  assert.deepEqual(row.brief.intake.evidence, [
    'Fundada em 2012',
    'Atendimento residencial',
  ]);
  assert.equal(row.brand.direction, 'moderno');
  assert.equal(row.brand.paletteSource, 'operador');
  assert.equal(row.brand.logoUrl, current.logoUrl);
  assert.match(row.brand.assetRevision, /^[0-9a-f-]{36}$/i);
  assert.deepEqual(row.contacts.phones, [
    { number: '1133334444', whatsapp: false },
    { number: '+5511988887777', whatsapp: true },
  ]);
  assert.deepEqual(current.deleted, []);
  assert.deepEqual(current.refreshed, ['/admin']);
  assert.equal(current.activities[0].action, 'tenant.create');
  assert.equal(current.activities[0].actor.name, 'Operador');
});

void test('cadastro recusa direção desconhecida antes de enviar o logo', async () => {
  const current = await fixture({ direction: 'inventada' });
  assert.match(await current.run(), /direção visual/i);
  assert.equal(current.inserted.length, 0);
  assert.equal(current.deleted.length, 0);
});

for (const insert of ['duplicate', 'error'])
  void test(`cadastro remove o upload quando o insert termina em ${insert}`, async () => {
    const current = await fixture({ insert });
    assert.match(
      await current.run(),
      insert === 'duplicate' ? /já pertence/ : /Não foi possível criar/,
    );
    assert.deepEqual(current.deleted, [current.logoUrl]);
    assert.equal(current.inserted.length, 0);
  });
