import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const {
  cleanLogo,
  prepareLogoAsset,
  displayHeightFor,
  markBox,
  removeUniformBackground,
  alphaBounds,
} = await jiti.import('../lib/images/logo-asset.ts');
const { currentLogoAsset } = await jiti.import('../lib/images/logo-schema.ts');

const source = 'https://assets.test/tenants/demo/logo/123-marca.jpg';
const tenant = {
  id: 'tenant-1',
  slug: 'demo',
  name: 'Marca',
  brand: { logoUrl: source, paper: '#faf6ed' },
};
const svg = (content) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">${content}</svg>`,
  );
const art =
  '<rect x="90" y="130" width="130" height="130" fill="#203746"/><rect x="260" y="150" width="240" height="90" fill="#c65f35"/>';

await test('JPG uniforme remove margem e contador pequeno, preservando branco interno grande', async () => {
  const bytes = await sharp(
    svg(
      `<rect width="600" height="400" fill="white"/>${art}<rect x="115" y="155" width="10" height="10" fill="white"/><rect x="280" y="165" width="85" height="55" fill="white"/>`,
    ),
  )
    .jpeg({ quality: 95 })
    .toBuffer();
  const clean = await cleanLogo(bytes);
  assert.equal(clean.background, 'removed');
  assert.ok(
    clean.width < 440 && clean.height < 160,
    JSON.stringify({ width: clean.width, height: clean.height }),
  );
  const rgba = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const result = removeUniformBackground({
    data: rgba.data,
    width: 600,
    height: 400,
  });
  assert.equal(result.data[(160 * 600 + 120) * 4 + 3], 0);
  assert.equal(result.data[(185 * 600 + 310) * 4 + 3], 255);
  assert.equal(result.data[(200 * 600 + 450) * 4 + 3], 255);
  assert.ok(alphaBounds(clean.rgba));
});

await test('PNG com alfa só recorta; gradiente opaco permanece inteiro', async () => {
  const bytes = await sharp(svg(art)).png().toBuffer();
  const clean = await cleanLogo(bytes);
  assert.equal(clean.background, 'transparent');
  assert.equal(clean.width, 426);
  assert.equal(clean.height, 146);
  const gradient = await sharp(
    svg(
      '<defs><linearGradient id="g"><stop stop-color="#111"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><rect width="600" height="400" fill="url(#g)"/>',
    ),
  )
    .png()
    .toBuffer();
  const untouched = await cleanLogo(gradient);
  assert.equal(untouched.background, 'opaque');
  assert.equal(untouched.width, 600);
  assert.equal(untouched.height, 400);
});

await test('altura segue proporção; símbolo precisa de componente relevante e vão', async () => {
  assert.deepEqual(
    [4, 3.5, 3, 2, 1.5, 1, 0.8].map(displayHeightFor),
    [40, 40, 48, 48, 56, 56, 64],
  );
  const clean = await cleanLogo(await sharp(svg(art)).png().toBuffer());
  const box = markBox(clean.rgba);
  assert.ok(box);
  assert.ok(
    Math.abs(((box[2] / box[3]) * clean.width) / clean.height - 1) < 0.01,
  );
  assert.equal(
    markBox({ width: 2, height: 2, data: new Uint8Array(16) }),
    undefined,
  );
});

await test('assets têm dimensões, placa opaca, maskable seguro e idempotência por hash', async () => {
  const files = new Map();
  let uploads = 0;
  const deps = {
    put: async (id, batch) => {
      assert.equal(id, tenant.id);
      uploads++;
      return batch.map((f) => {
        files.set(f.path.split('/').at(-1), f.body);
        return {
          url: `https://assets.test/tenants/demo/${f.path}`,
          pathname: f.path,
        };
      });
    },
  };
  const bytes = await sharp(svg(art)).png().toBuffer();
  const { asset } = await prepareLogoAsset({ tenant, source, bytes }, deps);
  assert.equal(uploads, 1);
  for (const [name, width, height] of [
    ['icon-32.png', 32, 32],
    ['icon-192.png', 192, 192],
    ['icon-512.png', 512, 512],
    ['icon-maskable-512.png', 512, 512],
    ['apple-180.png', 180, 180],
    ['og.png', 1200, 630],
  ]) {
    const meta = await sharp(files.get(name)).metadata();
    assert.equal(meta.width, width);
    assert.equal(meta.height, height);
    assert.equal(meta.hasAlpha, false, name);
  }
  assert.equal(asset.nav.height, 256);
  const mask = await sharp(files.get('icon-maskable-512.png'))
    .ensureAlpha()
    .raw()
    .toBuffer();
  // A tinta do símbolo fica no quadrado central de 60%, seguro sob máscara circular.
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 4;
      if (mask[i] < 70 && mask[i + 1] < 90 && mask[i + 2] < 100)
        assert.ok(x >= 102 && x < 410 && y >= 102 && y < 410);
    }
  const repeated = await prepareLogoAsset(
    {
      tenant: { ...tenant, brand: { ...tenant.brand, logoAsset: asset } },
      source,
      bytes,
    },
    deps,
  );
  assert.equal(uploads, 1);
  assert.deepEqual(repeated.asset, asset);
  assert.ok(currentLogoAsset({ logoUrl: source, logoAsset: asset }));
  assert.equal(
    currentLogoAsset({ logoUrl: source + 'stale', logoAsset: asset }),
    undefined,
  );
  assert.equal(
    currentLogoAsset({ logoUrl: source, logoAsset: { source } }),
    undefined,
  );
});

await test('SVG seguro preserva vetor com viewBox recortado; conteúdo ativo é recusado', async () => {
  const files = new Map();
  const { asset } = await prepareLogoAsset(
    { tenant, source, bytes: svg(art) },
    {
      put: async (_id, batch) =>
        batch.map((f) => {
          files.set(f.path.split('/').at(-1), f.body);
          return { url: `https://assets.test/${f.path}`, pathname: f.path };
        }),
    },
  );
  assert.equal(asset.svg.traced, false);
  assert.match(files.get('logo.svg'), /fill="#203746"/);
  assert.doesNotMatch(files.get('logo.svg'), /viewBox="0 0 600 400"/);
  assert.match(files.get('icon.svg'), /rect/);
  for (const content of [
    '<script>alert(1)</script>',
    '<foreignObject/>',
    '<use href="https://evil.test/a.svg#a"/>',
    '<rect onclick="alert(1)"/>',
  ])
    await assert.rejects(() => cleanLogo(svg(content)), /ativo|externa/);
});

await test('OG conserva o papel da marca e contrasta a tinta escura; master nunca ultrapassa 1024', async () => {
  const bytes = await sharp(
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="1000"><rect x="2" y="250" width="1996" height="500" fill="#151515"/></svg>',
    ),
  )
    .png()
    .toBuffer();
  const clean = await cleanLogo(bytes);
  assert.ok(
    Math.max(clean.width, clean.height) <= 1024,
    `${clean.width}x${clean.height}`,
  );
  const files = new Map();
  await prepareLogoAsset(
    {
      tenant: { ...tenant, brand: { ...tenant.brand, paper: '#161616' } },
      source,
      bytes,
    },
    {
      put: async (_id, batch) =>
        batch.map((f) => {
          files.set(f.path.split('/').at(-1), f.body);
          return { url: `https://assets.test/${f.path}`, pathname: f.path };
        }),
    },
  );
  const { data, info } = await sharp(files.get('og.png'))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixel = (x, y) => [
    ...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3),
  ];
  assert.deepEqual(pixel(0, 0), [22, 22, 22]);
  assert.deepEqual(pixel(600, 150), [255, 255, 255]);
  assert.ok(pixel(600, 315).every((value) => value < 30));
});
