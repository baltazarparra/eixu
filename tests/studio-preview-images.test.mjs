import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import nextImageLoader from 'next/dist/shared/lib/image-loader.js';
import { imageConfigDefault } from 'next/dist/shared/lib/image-config.js';
import {
  STUDIO_LEGACY_NEXT_CONFIG,
  studioScaffoldContent,
} from '../lib/studio/scaffold.ts';
import { studioSandboxFixture, workspace } from './helpers/studio-sandbox.mjs';

void test('loader real do Next aceita o Blob do cliente e recusa origens fora do contrato', async () => {
  const source = stripTypeScriptTypes(
    studioScaffoldContent('next.config.ts', 'fixture'),
  );
  const { default: config } = await import(
    `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  );
  const loadImage = (src) =>
    nextImageLoader.default({
      config: { ...imageConfigDefault, ...config.images },
      src,
      width: 640,
      quality: 75,
    });
  const origin = 'https://store.public.blob.vercel-storage.com';
  for (const path of ['logo/brand.png', 'images/hero.webp'])
    assert.match(
      loadImage(`${origin}/tenants/fixture/${path}`),
      /^\/_next\/image\?/,
    );
  for (const url of [
    `${origin}/tenants/outro/logo/brand.png`,
    `${origin}/studio/private.png`,
    `${origin}/tenants/fixture/logo.png?external=1`,
    'http://store.public.blob.vercel-storage.com/tenants/fixture/logo.png',
    'https://store.public.blob.vercel-storage.com:444/tenants/fixture/logo.png',
    'https://untrusted.example/tenants/fixture/logo.png',
    'http://127.0.0.1/internal.png',
  ])
    assert.throws(() => loadImage(url), /not configured/);
  assert.equal(config.images.maximumRedirects, 0);
});

for (const changed of [false, true])
  void test(`checkpoint antigo mantém configuração imutável; alteração reservada=${changed}`, async () => {
    const fixture = studioSandboxFixture();
    const content =
      STUDIO_LEGACY_NEXT_CONFIG + (changed ? '// alterado\n' : '');
    fixture.files.set(`${workspace}/next.config.ts`, Buffer.from(content));
    const checkpoint = fixture
      .load('lib/studio/checkpoint.ts')
      .checkpointStudioProject({
        runId: 'run',
        projectId: 'project',
        sandboxName: 'fixture',
        userId: 'user',
        workflowRunId: 'workflow',
      });
    if (changed) {
      await assert.rejects(checkpoint, /arquivo reservado next.config.ts/);
      assert.equal(fixture.blobCalls.length, 0);
    } else {
      assert.equal((await checkpoint).ok, true);
      const archive = fixture.blobCalls.find(
        (call) => call.type === 'put',
      ).data;
      assert.equal(JSON.parse(archive.toString())['next.config.ts'], content);
    }
  });

for (const options of [
  { previewStatus: 500 },
  { previewStatus: 307 },
  { previewAuthorized: false },
  { previewContentType: 'application/json' },
])
  void test(`prévia só persiste sessão com documento HTML autenticado e HTTP 200: ${JSON.stringify(options)}`, async () => {
    const fixture = studioSandboxFixture(options);
    await assert.rejects(
      fixture.load('lib/studio/sandbox.ts').ensureStudioPreview({
        name: 'fixture',
        projectId: 'project',
        codeRevision: fixture.codeRevision,
        contentRevisionId: 'content-A',
        userId: 'user',
      }),
      /prévia não iniciou/,
    );
    assert.equal(fixture.previewSession(), undefined);
  });
