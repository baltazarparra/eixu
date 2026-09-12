import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const { traceLogo, safeLogoSvg } = await jiti.import(
  '../lib/images/logo-trace.ts',
);

await test('metadados SVG dentro de PNG não transformam o bitmap em entrada XML', () => {
  const embedded = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    Buffer.from('<svg><image href="data:image/png;base64,x"/></svg>'),
  ]);
  assert.equal(safeLogoSvg(embedded), undefined);
});

await test('traçado de arte chapada passa o gate e não leva camada transparente', async () => {
  const master = await sharp(
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="280" height="110"><rect x="10" y="10" width="90" height="90" rx="16" fill="#287078"/><path d="M130 90V20h120v70z M150 70h80V40h-80z" fill="#cc6538" fill-rule="evenodd"/></svg>',
    ),
  )
    .png()
    .toBuffer();
  const result = await traceLogo(master);
  assert.ok(result);
  assert.ok(result.gate.iou >= 0.9);
  assert.ok(result.gate.colorError <= 24 / 255);
  assert.match(result.svg, /viewBox="0 0 280 110"/);
  assert.doesNotMatch(result.svg, /opacity="0"|<desc/);
});

await test('gradiente não vira vetor chapado falsamente fiel', async () => {
  const master = await sharp(
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="160"><defs><linearGradient id="g"><stop stop-color="#000000"/><stop offset="1" stop-color="#ff0000"/></linearGradient></defs><rect x="10" y="10" width="280" height="140" fill="url(#g)"/></svg>',
    ),
  )
    .png()
    .toBuffer();
  assert.equal(await traceLogo(master), null);
});
