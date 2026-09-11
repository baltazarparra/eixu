import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const ROUTES = [
  '.next/server/app/api/chat/route.js.nft.json',
  '.next/server/app/api/admin/[tenant]/generation/step/route.js.nft.json',
  '.next/server/app/api/queues/generation/route.js.nft.json',
];

for (const route of ROUTES)
  await test(`o artefato de ${route.split('/app/')[1]} inclui identidade e todos os binários de captura`, async () => {
    const root = process.cwd();
    const manifest = path.join(root, route);
    const trace = JSON.parse(await readFile(manifest, 'utf8'));
    const files = new Set(
      trace.files.map((file) => path.resolve(path.dirname(manifest), file)),
    );
    const binaries = 'node_modules/@sparticuz/chromium/bin';
    const assets = (await readdir(path.join(root, binaries)))
      .filter((file) => file.endsWith('.br'))
      .map((file) => `${binaries}/${file}`);
    assert(
      assets.length > 0,
      'O pacote Chromium precisa fornecer os binários.',
    );
    for (const relative of ['SOUL.md', ...assets]) {
      const file = path.join(root, relative);
      assert(
        files.has(file),
        `${relative} está ausente do artefato serverless.`,
      );
      assert((await stat(file)).size > 0, `${relative} está vazio.`);
    }
  });
