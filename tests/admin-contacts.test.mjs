import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
import { loadModule } from './helpers/load-module.mjs';

const jiti = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const { contactsFromForm, intakeFromForm } = await jiti.import(
  '../lib/admin/tenant-input.ts',
);
const { intakeForForm } = await jiti.import('../lib/tenant-intake.ts');
const {
  contactsOf,
  contactsSchema,
  formatPhone,
  phoneE164,
  primaryWhatsapp,
  whatsappAt,
} = await jiti.import('../lib/tenant-contacts.ts');
const { previewHref } = await jiti.import('../lib/sites/preview.ts');

async function legacyFixture({ runActive = false } = {}) {
  const row = {
    id: 'legacy-fixture',
    slug: 'fixture',
    name: 'Cliente antigo',
    contacts: {},
    whatsapp: '5511999990000',
    brand: {},
    brief: {
      intake: { socialUrl: 'https://www.instagram.com/fixture/' },
      social: {
        url: 'https://www.instagram.com/fixture/',
        network: 'instagram',
        status: 'ok',
        bio: 'Perfil já lido',
        avatarUrl: 'https://assets.test/avatar.png',
        lidoEm: '2026-09-11T00:00:00Z',
      },
    },
  };
  const queries = await loadModule('lib/tenant-queries.ts', {
    '@/lib/db': { db: () => async () => [row] },
  });
  const tenant = await queries.getTenantBySlug(row.slug);
  const cleared = [],
    written = [],
    sqls = [];
  const { PATCH } = await loadModule(
    'app/api/admin/[tenant]/settings/route.ts',
    {
      '@/lib/auth': { isAuthenticated: async () => true },
      '@/lib/tenant-queries': queries,
      '@/lib/db': {
        db:
          () =>
          async (_parts, ...values) => {
            sqls.push(_parts.join('?'));
            written.push(values);
            return [];
          },
      },
      '@/lib/ai/social': {
        clearSocialProfile: async (id) => cleared.push(id),
        markSocialReading: async () =>
          assert.fail('Não deve reler o mesmo perfil'),
        syncSocialProfile: async () => assert.fail('Não deve acessar a rede'),
      },
      '@/lib/generation/runs': { activeRun: async () => runActive },
      'next/server': { after: () => assert.fail('Não deve agendar leitura') },
    },
  );
  return {
    tenant,
    row,
    cleared,
    written,
    sqls,
    request: (body) =>
      PATCH(
        new Request('https://fixture.test/api/admin/fixture/settings', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ tenant: row.slug }) },
      ),
    save: async (remove = false) => {
      // Os campos repetidos são os mesmos que Dados recebe de tenant.contacts.
      const form = new FormData();
      form.set(
        'story',
        intakeForForm(row.brief.intake).story ||
          'Cliente antigo com perfil social já lido; o operador completa esta história ao salvar os dados.',
      );
      for (const phone of tenant.contacts.phones) {
        form.append('phone', formatPhone(phone.number));
        form.append('phoneKind', phone.whatsapp ? 'whatsapp' : 'telefone');
      }
      for (const social of remove ? [] : tenant.contacts.social)
        form.append('social', social);
      const contacts = contactsFromForm(form).data;
      const intake = intakeFromForm(form).data;
      const response = await PATCH(
        new Request('https://fixture.test/api/admin/fixture/settings', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Nome atualizado', contacts, intake }),
        }),
        { params: Promise.resolve({ tenant: row.slug }) },
      );
      assert.equal(response.status, 200);
      return { contacts, intake, body: await response.json() };
    },
  };
}

await test('Dados conserva o perfil e o avatar de cliente anterior à coluna de contatos', async () => {
  const f = await legacyFixture();
  assert.deepEqual(f.tenant.contacts.social, [f.row.brief.intake.socialUrl]);
  const result = await f.save();
  assert.equal(result.intake.socialUrl, f.row.brief.intake.socialUrl);
  assert.equal(result.body.social.avatarUrl, f.row.brief.social.avatarUrl);
  assert.deepEqual(f.cleared, []);
  assert.equal(f.written.length, 1);
  assert.ok(f.written[0].includes(JSON.stringify(result.intake)));
  assert.match(f.sqls[0], /brief - 'audience'.*'imageScenes'/s);
});

await test('API exige história, limita referência e protege uma geração ativa', async () => {
  const f = await legacyFixture();
  assert.equal((await f.request({ intake: { references: [] } })).status, 400);
  assert.equal(
    (
      await f.request({
        intake: {
          story: 'História suficiente para o novo cadastro.',
          references: ['https://one.test/', 'https://two.test/'],
        },
      })
    ).status,
    400,
  );
  const active = await legacyFixture({ runActive: true });
  const response = await active.request({
    intake: {
      story:
        'História nova do cliente, com público, região, oferta e trajetória reunidos.',
      references: ['https://one.test/'],
    },
  });
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /Pause a geração/);
  assert.equal(active.written.length, 0);
});

await test('remoção explícita da rede antiga continua limpando o perfil e não o ressuscita', async () => {
  const f = await legacyFixture();
  const result = await f.save(true);
  assert.equal(result.intake.socialUrl, '');
  assert.equal(result.body.social, null);
  assert.deepEqual(f.cleared, [f.row.id]);
  assert.deepEqual(
    contactsOf(result.contacts, null, f.row.brief.intake.socialUrl).social,
    [],
  );
  assert.deepEqual(
    contactsOf(undefined, null, f.row.brief.intake.socialUrl).social,
    [f.row.brief.intake.socialUrl],
  );
});

await test('DDI explícito sobrevive a cadastro, leitura e edição sem alterar destinos de WhatsApp', () => {
  for (const [input, expected] of [
    ['+1 415 555 2671', '+14155552671'],
    ['+65 6123 4567', '+6561234567'],
    ['+55 (11) 99999-0000', '+5511999990000'],
    ['11 3333-4444', '1133334444'],
    ['11 99999-0000', '11999990000'],
    ['442071234567', '+442071234567'],
  ]) {
    const saved = contactsSchema.parse({
      phones: [{ number: input, whatsapp: true }],
    });
    const loaded = contactsOf(JSON.parse(JSON.stringify(saved)));
    const form = new FormData();
    form.append('phone', formatPhone(loaded.phones[0].number));
    form.append('phoneKind', 'whatsapp');
    const edited = contactsFromForm(form).data;
    assert.equal(phoneE164(loaded.phones[0].number), expected, input);
    assert.equal(phoneE164(edited.phones[0].number), expected, input);
    const wa = expected.replace(/\D/g, '');
    assert.equal(primaryWhatsapp(edited), wa);
    assert.equal(whatsappAt(edited, 0), wa);
    assert.equal(
      previewHref('/go/wa?n=0', {
        isPreview: true,
        tenant: { slug: 'fixture', contacts: edited, whatsapp: wa },
      }),
      `https://wa.me/${wa}`,
    );
  }
  assert.equal(formatPhone('+14155552671'), '+14155552671');
  const duplicate = contactsSchema.parse({
    phones: [
      { number: '+55 11 99999-0000', whatsapp: true },
      { number: '5511999990000', whatsapp: false },
    ],
  });
  assert.equal(duplicate.phones.length, 1);
  assert.equal(
    contactsSchema.parse({
      phones: [{ number: '+65 6123 4567' }, { number: '65 6123-4567' }],
    }).phones.length,
    2,
  );
});
