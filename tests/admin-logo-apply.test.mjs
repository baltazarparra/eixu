import { mockLogoAssets } from './helpers/logo-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { loadModule } from './helpers/load-module.mjs';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const sharp = require('sharp');

/** PNG sem alfa: placa branca com texto preto, o caso da captura do operador. */
async function plateWhite() {
  const text = await sharp({
    create: { width: 120, height: 40, channels: 4, background: '#111111' },
  })
    .png()
    .toBuffer();
  const composed = await sharp({
    create: { width: 200, height: 120, channels: 4, background: '#ffffff' },
  })
    .composite([{ input: text, left: 40, top: 40 }])
    .png()
    .toBuffer();
  // Em passo separado: no mesmo pipeline o flatten corre antes do composite.
  return sharp(composed).flatten({ background: '#ffffff' }).png().toBuffer();
}

async function fixture({ approve = true, current } = {}) {
  const source = 'https://blob.test/tenants/fixture/logo/1-logo.png';
  const revision = 'application-1';
  const calls = {
    scheduled: [],
    derived: [],
    blobs: [],
    inserted: [],
    critiques: [],
    assets: [],
  };
  const png = await plateWhite();
  const { applyBrandLogo, applyBrandLogoDark, deriveLogoAssets } =
    await loadModule('lib/images/logo-apply.ts', {
      'next/server': { after: (callback) => calls.scheduled.push(callback) },
      '@/lib/tenant-queries': {
        setBrandLogoDark: async (_id, url) => ({
          logoUrl: source,
          logoDarkUrl: url,
          logoRevision: revision,
        }),
        setBrandLogo: async (_id, url) => ({
          logoUrl: url,
          logoRevision: revision,
        }),
        setBrandLogoDerived: async (
          _id,
          measured,
          derived,
          appliedRevision,
        ) => {
          calls.derived.push({
            source: measured,
            revision: appliedRevision,
            ...derived,
          });
          return (current ?? source) === measured;
        },
      },
      '@/lib/images/logo': {
        fetchReferenceRaw: async () => ({
          bytes: png,
          contentType: 'image/png',
        }),
      },
      '@/lib/images/logo-asset': mockLogoAssets((file) =>
        calls.assets.push(file),
      ),
      '@/lib/blob/tenant-files': {
        putTenantBlob: async (_id, pathname, body) => {
          calls.blobs.push({ pathname, bytes: body.length });
          return {
            url: `https://blob.test/tenants/fixture/${pathname}`,
            pathname,
          };
        },
      },
      '@/lib/images/queries': {
        insertImage: async (input) => {
          calls.inserted.push(input);
          return { id: 'img-branca', seq: 9, ...input };
        },
      },
      '@/lib/images/logo-critic': {
        critiqueLogo: async (input) => {
          calls.critiques.push(input);
          return {
            aprovado: approve,
            nota: approve ? 8 : 3,
            variante: input.variant,
          };
        },
      },
    });
  const tenant = {
    id: 'tenant-1',
    slug: 'fixture',
    name: 'Fixture',
    brand: {
      logoUrl: source,
      paper: '#0b0e14',
      ink: '#f5f5f4',
      logoRevision: revision,
    },
  };
  return {
    applyBrandLogo,
    applyBrandLogoDark,
    deriveLogoAssets,
    calls,
    tenant,
    source,
    revision,
  };
}

await test('aplicar o logo grava a URL e agenda medição e versão escura depois da resposta', async () => {
  const f = await fixture();
  const brand = await f.applyBrandLogo(f.tenant, f.source);
  assert.deepEqual(brand, { logoUrl: f.source, logoRevision: f.revision });
  assert.equal(f.calls.scheduled.length, 1);
  assert.equal(f.calls.derived.length, 0);

  await f.calls.scheduled[0]();
  // Primeiro a medição, depois a versão escura aprovada.
  assert.equal(f.calls.derived.length, 2);
  assert.equal(f.calls.derived[0].source, f.source);
  assert.ok(f.calls.derived.every((call) => call.revision === f.revision));
  assert.equal(f.calls.derived[0].fit.plate, null);
  assert.equal(f.calls.derived[0].asset.background, 'removed');
  assert.ok(f.calls.derived[0].fit.width < 150);
  assert.ok(f.calls.derived[1].darkAsset.nav.url.endsWith('/nav-dark.png'));
  assert.equal(f.calls.derived[0].fit.hasAlpha, true);
  assert.match(f.calls.derived[1].darkUrl, /\/logo\/[0-9a-f-]+\/branca\.png$/);
  assert.equal(f.calls.blobs.length, 1);
  assert.match(f.calls.blobs[0].pathname, /^logo\/[0-9a-f-]+\/branca\.png$/);
  const [row] = f.calls.inserted;
  assert.equal(row.kind, 'logo');
  assert.equal(row.model, 'sharp/luminance-cut');
  // O módulo corre em outro realm do vm: compara-se o conteúdo, não o protótipo.
  assert.deepEqual([...row.referenceUrls], [f.source]);
  const [critique] = f.calls.critiques;
  assert.equal(critique.mode, 'derivar');
  assert.equal(critique.variant, 'branca');
  assert.equal(critique.wordmark, false);
  assert.equal(critique.surface, '#0b0e14');
  assert.ok(critique.reference.length > 0);
});

await test('versão reprovada pelo crítico fica na biblioteca sem entrar na marca', async () => {
  const f = await fixture({ approve: false });
  await f.deriveLogoAssets(f.tenant, f.source);
  assert.equal(f.calls.inserted.length, 1);
  assert.equal(f.calls.derived.length, 1);
  assert.equal(f.calls.derived[0].darkUrl, undefined);
});

await test('logo trocado durante a derivação não recebe a medição nem a versão do anterior', async () => {
  const f = await fixture({
    current: 'https://blob.test/tenants/fixture/logo/2-outro.png',
  });
  await f.deriveLogoAssets(f.tenant, f.source);
  assert.equal(f.calls.derived.length, 1);
  assert.equal(f.calls.blobs.length, 0);
  assert.equal(f.calls.inserted.length, 0);
});

await test('logo com assets frescos e versão escura não é derivado de novo', async () => {
  const f = await fixture();
  await f.deriveLogoAssets(f.tenant, f.source);
  f.calls.derived.length = 0;
  f.calls.blobs.length = 0;
  f.calls.assets.length = 0;
  await f.deriveLogoAssets(f.tenant, f.source);
  assert.equal(f.calls.derived.length, 0);
  assert.equal(f.calls.blobs.length, 0);
  assert.equal(f.calls.assets.length, 0);
});

await test('wait:true aguarda o asset e versão escura; escolha manual prepara só nav escuro', async () => {
  const f = await fixture();
  const brand = await f.applyBrandLogo(f.tenant, f.source, { wait: true });
  assert.equal(f.calls.scheduled.length, 0);
  assert.ok(brand.logoAsset);
  assert.ok(brand.logoDarkAsset);
  f.calls.derived.length = 0;
  f.calls.assets.length = 0;
  const dark = await f.applyBrandLogoDark(
    f.tenant,
    'https://blob.test/manual.png',
    { wait: true },
  );
  assert.ok(dark.logoDarkAsset);
  assert.equal(f.calls.assets.length, 1);
  assert.ok(f.calls.derived[0].darkAsset);
  assert.equal(f.calls.derived[0].darkUrl, undefined);
});

await test('trocar e publicar pelo mesmo chat usa a marca devolvida pela aplicação', async () => {
  const f = await fixture();
  let published;
  const { buildTools } = await loadModule('lib/ai/tools.ts', {
    '@/lib/images/logo-apply': { applyBrandLogo: f.applyBrandLogo },
    '@/lib/images/queries': {
      getImageByNumber: async (tenantId, seq) => {
        assert.equal(tenantId, f.tenant.id);
        return { seq, kind: 'logo', status: 'disponivel', url: f.source };
      },
    },
    '@/lib/sites/publish': {
      publishSite: async (tenant) => {
        published = tenant;
        return { ok: true };
      },
    },
  });
  const tools = buildTools(
    {
      ...f.tenant,
      brand: {
        ...f.tenant.brand,
        logoUrl: 'https://blob.test/anterior.png',
        logoDarkUrl: 'https://blob.test/anterior-branca.png',
        logoFit: { source: 'https://blob.test/anterior.png' },
      },
      brief: {},
      dials: {},
    },
    { lastUserText: 'Use o logo #2 e publique o site' },
  );
  const applied = await tools.set_site_logo.execute({ image: '#2' });
  assert.equal(applied.ok, true, JSON.stringify(applied));
  await tools.publish_site.execute({});
  assert.equal(published.brand.logoUrl, f.source);
  assert.equal(published.brand.logoDarkUrl, undefined);
  assert.equal(published.brand.logoFit, undefined);
  assert.equal(published.brand.logoRevision, f.revision);
});
