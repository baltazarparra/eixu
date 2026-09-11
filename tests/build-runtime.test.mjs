import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

await test('o artefato do chat inclui identidade e todos os binários de captura', async () => {
  const root = process.cwd();
  const manifest = path.join(
    root,
    '.next/server/app/api/chat/route.js.nft.json',
  );
  const trace = JSON.parse(await readFile(manifest, 'utf8'));
  const files = new Set(
    trace.files.map((file) => path.resolve(path.dirname(manifest), file)),
  );
  const binaries = 'node_modules/@sparticuz/chromium/bin';
  const assets = (await readdir(path.join(root, binaries)))
    .filter((file) => file.endsWith('.br'))
    .map((file) => `${binaries}/${file}`);
  assert(assets.length > 0, 'O pacote Chromium precisa fornecer os binários.');
  for (const relative of ['SOUL.md', ...assets]) {
    const file = path.join(root, relative);
    assert(files.has(file), `${relative} está ausente do artefato serverless.`);
    assert((await stat(file)).size > 0, `${relative} está vazio.`);
  }
});
