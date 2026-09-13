import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createJiti } from 'jiti';
import { loadModule } from './helpers/load-module.mjs';

const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  jsx: { runtime: 'automatic' },
});

async function fixture({
  insert = 'ok',
  socialFails = false,
  vibe = 'ousado',
  currentSiteUrl = '',
} = {}) {
  const deleted = [],
    inserted = [],
    scheduled = [],
    refreshed = [],
    derived = [];
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
            // Posicional: o insert grava slug, nome, WhatsApp derivado,
            // e-mail, briefing, marca e contatos, nessa ordem.
            const [slug, name, whatsapp, contactEmail, brief, brand, contacts] =
              values;
            inserted.push({
              slug,
              name,
              whatsapp,
              contactEmail,
              brief: JSON.parse(brief),
              brand: JSON.parse(brand),
              contacts: JSON.parse(contacts),
            });
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
      '@/lib/images/logo-apply': {
        deriveLogoAssets: async (tenant, url) => {
          assert.ok(inserted[0].brand.logoRevision);
          assert.equal(
            tenant.brand.logoRevision,
            inserted[0].brand.logoRevision,
          );
          derived.push(url);
        },
      },
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
    contactEmail: 'contato@fixture.com.br',
    story:
      'A Fixture trabalha com pedras naturais para projetos de arquitetura em Bauru. Atende arquitetos e pessoas em reforma que procuram orientação para escolher os materiais e iniciar uma conversa comercial.',
    primary: '#112233',
    secondary: '#445566',
    highlight: '#ffffff',
    vibe,
  }))
    form.set(key, value);
  if (currentSiteUrl) form.set('currentSiteUrl', currentSiteUrl);
  // Duas linhas de contato: a primeira é telefone comum, então o WhatsApp
  // gravado precisa ser o segundo número.
  for (const [number, kind] of [
    ['11 3333-4444', 'telefone'],
    ['+55 11 98888-7777', 'whatsapp'],
  ]) {
    form.append('phone', number);
    form.append('phoneKind', kind);
  }
  form.append('addressLabel', 'Loja');
  form.append('addressText', 'Rua das Pedras, 100, Bauru');
  form.append('social', 'https://www.instagram.com/fixture/');
  form.set('logo', new File(['synthetic'], 'logo.png', { type: 'image/png' }));
  return {
    run: () => createTenantAction(null, form),
    deleted,
    inserted,
    scheduled,
    refreshed,
    derived,
    logo,
  };
}

await test('cadastro preserva o logo e abre o editor quando a leitura social falha', async () => {
  const f = await fixture({ socialFails: true });
  await assert.rejects(f.run, /redirect:\/admin\/fixture/);
  assert.equal(f.inserted[0].brand.logoUrl, f.logo);
  assert.equal(f.deleted.length, 0);
  // Só a medição do logo fica agendada; a leitura social falhou antes.
  assert.equal(f.scheduled.length, 1);
  await Promise.all(f.scheduled.map((run) => run()));
  assert.deepEqual(f.derived, [f.logo]);
  assert.deepEqual(f.refreshed, ['/admin']);
});

await test('cadastro agenda a leitura social e a medição do logo depois de persistir a marca', async () => {
  const f = await fixture();
  await assert.rejects(f.run, /redirect:\/admin\/fixture/);
  assert.equal(f.inserted.length, 1);
  assert.equal(f.scheduled.length, 2);
  assert.equal(f.deleted.length, 0);
  // A leitura sai da lista de redes, que substituiu o campo do briefing.
  assert.equal(
    f.inserted[0].brief.intake.socialUrl,
    'https://www.instagram.com/fixture/',
  );
});

await test('cadastro grava contatos, vibe e o WhatsApp derivado da lista', async () => {
  const f = await fixture();
  await assert.rejects(f.run, /redirect:\/admin\/fixture/);
  const row = f.inserted[0];
  assert.equal(row.whatsapp, '5511988887777');
  assert.equal(row.contactEmail, 'contato@fixture.com.br');
  assert.equal(row.brand.vibe, 'ousado');
  assert.deepEqual(row.contacts.phones, [
    { number: '1133334444', whatsapp: false },
    { number: '+5511988887777', whatsapp: true },
  ]);
  assert.deepEqual(row.contacts.addresses, [
    { label: 'Loja', text: 'Rua das Pedras, 100, Bauru' },
  ]);
  assert.deepEqual(row.contacts.social, ['https://www.instagram.com/fixture/']);
  assert.match(row.brief.intake.story, /pedras naturais/);
  assert.equal(row.brief.intake.currentSiteUrl, '');
  assert.equal(row.brief.intake.offer, '');
  assert.equal(row.brief.intake.references.length, 0);
});

await test('cadastro preserva o site atual separado da referência visual', async () => {
  const f = await fixture({ currentSiteUrl: 'https://fixture.com.br/' });
  await assert.rejects(f.run, /redirect:\/admin\/fixture/);
  assert.equal(
    f.inserted[0].brief.intake.currentSiteUrl,
    'https://fixture.com.br/',
  );
  assert.deepEqual(f.inserted[0].brief.intake.references, []);
});

await test('vibe desconhecida recusa o cadastro antes de enviar o logo', async () => {
  const f = await fixture({ vibe: 'inventada' });
  assert.match(await f.run(), /vibe/i);
  assert.equal(f.inserted.length, 0);
  assert.equal(f.deleted.length, 0);
  assert.equal(f.scheduled.length, 0);
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

await test('cadastro exibe história obrigatória e uma única referência fora do contexto opcional', async () => {
  const { TenantFields } = await j.import(
    '../components/admin/tenant-fields.tsx',
  );
  const markup = renderToStaticMarkup(
    createElement(TenantFields, { compact: true, withSlug: true }),
  );
  assert.match(markup, /História do cliente/);
  assert.match(markup, /name="story"[^>]*required/);
  assert.match(markup, /<input[^>]*type="url"[^>]*name="reference"/);
  assert.match(markup, /Referência para o site/);
  assert.match(markup, /name="currentSiteUrl"/);
  assert.ok(
    markup.indexOf('name="currentSiteUrl"') <
      markup.indexOf('name="reference"'),
  );
  assert.match(markup, /navega pelas páginas públicas desse domínio/);
  assert.equal(markup.includes('O que o site precisa fazer'), false);
  assert.equal(markup.includes('Segmento</span>'), false);
  assert.equal(markup.includes('Região atendida'), false);
  assert.equal(markup.includes('Para quem vende'), false);
  assert.equal(markup.includes('name="references"'), false);
});
