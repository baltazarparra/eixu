import assert from 'node:assert/strict';
import test, { after, mock } from 'node:test';

// Use o transporte Web do SDK para simular HTTP sem conexões externas.
const originalEdgeRuntime = globalThis.EdgeRuntime;
globalThis.EdgeRuntime = 'test';
let respond;
const fetch = mock.method(globalThis, 'fetch', (...args) => respond(...args));
after(() => {
  mock.restoreAll();
  if (originalEdgeRuntime === undefined) delete globalThis.EdgeRuntime;
  else globalThis.EdgeRuntime = originalEdgeRuntime;
});
const { downloadAssets, mapToolResultOutput } = await import('ai/internal');
const { downloadStudioAssetsStep } =
  await import('../lib/studio/workflow-download.ts');

const url = new URL(
  'https://fixture.public.blob.vercel-storage.com/tenants/fixture/logo.png',
);
const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

void test('download de imagem mantém bytes, MIME, ordem e URLs aceitas pelo modelo', async () => {
  fetch.mock.resetCalls();
  respond = async () =>
    new Response(bytes, { headers: { 'content-type': 'image/png' } });
  const result = await downloadStudioAssetsStep([
    { url, isUrlSupportedByModel: true },
    { url, isUrlSupportedByModel: false },
  ]);
  assert.equal(result[0], null);
  assert.deepEqual(result[1].data, bytes);
  assert.equal(result[1].mediaType, 'image/png');
  assert.equal(fetch.mock.callCount(), 1);
});

void test('SDK converte logo de ferramenta e anexo do chat em imagem com o downloader do step', async () => {
  respond = async () =>
    new Response(bytes, { headers: { 'content-type': 'image/png' } });
  const output = {
    type: 'content',
    value: [{ type: 'file', data: { type: 'url', url }, mediaType: 'image' }],
  };
  const assets = await downloadAssets(
    [
      { role: 'user', content: [{ type: 'image', image: url }] },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'context',
            toolName: 'read_project_context',
            output,
          },
        ],
      },
    ],
    downloadStudioAssetsStep,
    {},
  );
  const converted = mapToolResultOutput({ output, downloadedAssets: assets });
  assert.equal(converted.type, 'content');
  assert.equal(converted.value[0].type, 'file');
  assert.equal(converted.value[0].mediaType, 'image/png');
  assert.equal(converted.value[0].data.type, 'data');
  assert.deepEqual(converted.value[0].data.data, bytes);
});

void test('download propaga HTTP recusado sem transformar falha em imagem vazia', async () => {
  respond = async () => new Response(null, { status: 404 });
  await assert.rejects(
    downloadStudioAssetsStep([{ url, isUrlSupportedByModel: false }]),
    /404/,
  );
});
