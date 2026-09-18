import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = process.cwd();
const dependencyRoot = path.join(root, 'node_modules/undici');
const traces = [
  '.next/server/app/.well-known/workflow/v1/flow/route.js.nft.json',
  '.next/server/app/api/chat/route.js.nft.json',
];

// Não deixe o node_modules local mascarar dependências ausentes no deploy.
for (const trace of traces) {
  const manifestPath = path.join(root, trace);
  const { files } = JSON.parse(await readFile(manifestPath, 'utf8'));
  const dependencies = files
    .map((file) => path.resolve(path.dirname(manifestPath), file))
    .filter((file) => file.startsWith(`${dependencyRoot}${path.sep}`));
  assert.ok(
    dependencies.includes(path.join(dependencyRoot, 'package.json')),
    `${trace}: undici ausente no pacote da função`,
  );

  const isolated = await mkdtemp(path.join(tmpdir(), 'eixu-runtime-'));
  try {
    for (const source of dependencies) {
      const destination = path.join(isolated, path.relative(root, source));
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(source, destination);
    }
    const require = createRequire(
      path.join(isolated, '.next/server/chunks/ai-runtime.js'),
    );
    assert.ok(require.resolve('undici').startsWith(`${isolated}${path.sep}`));
    const { Agent, fetch } = require('undici');
    assert.equal(typeof fetch, 'function');
    const dispatcher = new Agent();
    await dispatcher.close();
    console.log(`Runtime verificado: ${trace} resolve undici isoladamente.`);
  } finally {
    await rm(isolated, { recursive: true, force: true });
  }
}
