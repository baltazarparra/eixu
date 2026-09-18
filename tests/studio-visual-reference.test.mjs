import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModuleGraph } from './helpers/load-module.mjs';

const { isPublicAddress, publicResource } = loadModuleGraph(
  'lib/references/network.ts',
);

void test('captura aceita IPv4 público sem liberar redes privadas, reservadas ou IPv4 mapeado', async () => {
  for (const ip of ['104.17.57.49', '8.8.8.8', '1.1.1.1', '2606:4700::1111'])
    assert.equal(isPublicAddress(ip), true, ip);
  for (const ip of [
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.0.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '198.51.100.1',
    '::',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:104.17.57.49',
    '2001:db8::1',
  ])
    assert.equal(isPublicAddress(ip), false, ip);
  for (const url of [
    'http://127.0.0.1/',
    'http://[::ffff:127.0.0.1]/',
    'http://169.254.169.254/',
    'file:///etc/passwd',
    'https://user:secret@example.com/',
    'https://example.com:8080/',
  ])
    await assert.rejects(
      publicResource(url),
      /Rede não pública|URL pública inválida/,
    );
});

function referenceFixture({ denied = false, unavailable = false } = {}) {
  const captured = [],
    stored = new Map(),
    events = [];
  const { studioTools } = loadModuleGraph('lib/studio/tools.ts', {
    '@/lib/db': {
      db: () => async (parts) =>
        parts.join('?').includes('select run.status')
          ? denied
            ? []
            : [{ status: 'running' }]
          : [],
    },
    './context': {
      studioClientContext: async () => ({
        client: {
          brief: {
            intake: { references: ['https://registered.example/layout'] },
          },
          brand: {},
        },
      }),
    },
    './runs': {
      nextStudioEvent: async (_id, type, data) =>
        events.push({ type, ...data }),
    },
    '@/lib/references/capture': {
      captureReference: async (url) => {
        captured.push(url);
        if (unavailable) throw new Error('Referência não acessível');
        return ['desktop', 'mobile'].map((viewport) => ({
          viewport,
          width: 390,
          height: 844,
          pageHeight: 844,
          truncated: false,
          url,
          unavailableResources: 0,
          styles: [],
          jpeg: Buffer.from(`${url}:${viewport}`),
        }));
      },
    },
    '@vercel/blob': {
      put: async (path, data, options) => {
        assert.equal(options.access, 'private');
        stored.set(path, data);
      },
      get: async (path) => ({
        statusCode: 200,
        stream: new Response(stored.get(path)).body,
      }),
    },
    '@/lib/blob/stores.mjs': {
      privateBlobOptions: async () => ({ storeId: 'private' }),
    },
  });
  return {
    tool: studioTools.inspect_visual_reference,
    captured,
    stored,
    events,
  };
}

const context = {
  runId: 'run',
  projectId: 'project',
  tenantId: 'tenant',
  sandboxName: 'sandbox',
  workflowRunId: 'workflow',
};

void test('link do chat prevalece sobre cadastro e duas referências mantêm suas imagens multimodais', async () => {
  const fixture = referenceFixture();
  const url = 'https://new-reference.example/layout';
  const first = await fixture.tool.execute({ url }, { context });
  const second = await fixture.tool.execute(
    { url: 'https://another-reference.example/' },
    { context },
  );
  assert.deepEqual(fixture.captured, [
    url,
    'https://another-reference.example/',
  ]);
  assert.equal(first.url, url);
  assert.equal(first.source, 'operator');
  assert.equal(first.status, 'ok');
  assert.equal(
    new Set([...first.shots, ...second.shots].map((shot) => shot.storageKey))
      .size,
    4,
  );
  const output = await fixture.tool.toModelOutput({ output: first });
  assert.equal(output.type, 'content');
  assert.equal(output.value.filter((part) => part.type === 'file').length, 2);
  assert.equal(
    Buffer.from(output.value[1].data.data).toString(),
    `${url}:desktop`,
  );
  await fixture.tool.execute({}, { context });
  assert.equal(fixture.captured.at(-1), 'https://registered.example/layout');
});

void test('referência indisponível não é substituída silenciosamente pelo cadastro', async () => {
  const fixture = referenceFixture({ unavailable: true });
  const result = await fixture.tool.execute(
    { url: 'https://new-reference.example/' },
    { context },
  );
  assert.deepEqual(fixture.captured, ['https://new-reference.example/']);
  assert.equal(result.status, 'unavailable');
  assert.equal(fixture.stored.size, 0);
  assert.equal(fixture.events[0].status, 'unavailable');
});

void test('a nova URL não ignora autorização do projeto nem validação na fronteira do Workflow', async () => {
  const denied = referenceFixture({ denied: true });
  await assert.rejects(
    denied.tool.execute({ url: 'https://example.com/' }, { context }),
    /Acesso ao projeto recusado/,
  );
  assert.equal(denied.captured.length, 0);
  const fixture = referenceFixture();
  await assert.rejects(
    fixture.tool.execute({ url: 'file:///etc/passwd' }, { context }),
    (error) => error.name === 'ZodError',
  );
  assert.equal(fixture.captured.length, 0);
});
