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
  const calls = { scheduled: [], derived: [], blobs: [], inserted: [], critiques: [] };
  const png = await plateWhite();
  const { applyBrandLogo, deriveLogoAssets } = await loadModule(
    'lib/images/logo-apply.ts',
    {
      'next/server': { after: (callback) => calls.scheduled.push(callback) },
      '@/lib/tenant-queries': {
        setBrandLogo: async (_id, url) => ({ logoUrl: url }),
        setBrandLogoDerived: async (_id, measured, derived) => {
          calls.derived.push({ source: measured, ...derived });
          return (current ?? source) === measured;
        },
      },
      '@/lib/images/logo': { fetchReference: async () => png },
      '@/lib/blob/tenant-files': {
        putTenantBlob: async (_id, pathname, body) => {
          calls.blobs.push({ pathname, bytes: body.length });
          return { url: `https://blob.test/tenants/fixture/${pathname}`, pathname };
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
          return { aprovado: approve, nota: approve ? 8 : 3, variante: input.variant };
        },
      },
    },
  );
  const tenant = {
    id: 'tenant-1',
    slug: 'fixture',
    name: 'Fixture',
    brand: { paper: '#0b0e14', ink: '#f5f5f4' },
  };
  return { applyBrandLogo, deriveLogoAssets, calls, tenant, source };
}

await test('aplicar o logo grava a URL e agenda medição e versão escura depois da resposta', async () => {
  const f = await fixture();
  const brand = await f.applyBrandLogo(f.tenant, f.source);
  assert.deepEqual(brand, { logoUrl: f.source });
  assert.equal(f.calls.scheduled.length, 1);
  assert.equal(f.calls.derived.length, 0);

  await f.calls.scheduled[0]();
  // Primeiro a medição, depois a versão escura aprovada.
  assert.equal(f.calls.derived.length, 2);
  assert.equal(f.calls.derived[0].source, f.source);
  assert.equal(f.calls.derived[0].fit.plate, 'light');
  assert.equal(f.calls.derived[0].fit.hasAlpha, false);
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
  const f = await fixture({ current: 'https://blob.test/tenants/fixture/logo/2-outro.png' });
  await f.deriveLogoAssets(f.tenant, f.source);
  assert.equal(f.calls.derived.length, 1);
  assert.equal(f.calls.blobs.length, 0);
  assert.equal(f.calls.inserted.length, 0);
});

await test('logo já medido e com versão escura não é derivado de novo', async () => {
  const f = await fixture();
  await f.deriveLogoAssets(
    {
      ...f.tenant,
      brand: {
        ...f.tenant.brand,
        logoUrl: f.source,
        logoFit: { source: f.source },
        logoDarkUrl: 'https://blob.test/tenants/fixture/logo/b/branca.png',
      },
    },
    f.source,
  );
  assert.equal(f.calls.derived.length, 0);
  assert.equal(f.calls.blobs.length, 0);
});
