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

function element({
  tag,
  id = '',
  classes = [],
  text = '',
  top = 0,
  height = 400,
  width = 1200,
  style = {},
  children = [],
}) {
  const node = {
    tagName: tag.toUpperCase(),
    id,
    classList: classes,
    children,
    style: {
      display: 'block',
      visibility: 'visible',
      backgroundColor: 'rgb(255, 255, 255)',
      color: 'rgb(17, 17, 17)',
      fontFamily: 'Inter, sans-serif',
      fontSize: '16px',
      fontWeight: '400',
      lineHeight: '24px',
      letterSpacing: 'normal',
      textTransform: 'none',
      gridTemplateColumns: 'none',
      gap: 'normal',
      padding: '0px',
      ...style,
    },
    getBoundingClientRect: () => ({ top, height, width }),
    get textContent() {
      return [text, ...children.map((child) => child.textContent)].join(' ');
    },
    descendants() {
      return children.flatMap((child) => [child, ...child.descendants()]);
    },
    querySelectorAll(selector) {
      const tags = selector
        .split(',')
        .map((part) => part.trim().toUpperCase())
        .filter((part) => /^[A-Z][A-Z0-9]*$/.test(part));
      return this.descendants().filter((child) => tags.includes(child.tagName));
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] ?? null;
    },
  };
  return node;
}

void test('a leitura da referência entrega a sequência de faixas, tipografia e paleta', async () => {
  const { referenceOutline } = await import('../lib/references/outline.ts');
  const hero = element({
    tag: 'section',
    id: 'hero',
    classes: ['hero', 'dark'],
    height: 720,
    style: {
      backgroundColor: 'rgb(10, 10, 10)',
      color: 'rgb(255, 255, 255)',
      padding: '96px 64px',
    },
    children: [
      element({ tag: 'h1', text: 'Fachada em primeiro plano', height: 80 }),
      element({ tag: 'img', text: '', height: 400 }),
      element({ tag: 'a', text: 'Fale conosco', height: 48 }),
    ],
  });
  const grid = element({
    tag: 'section',
    classes: ['ofertas'],
    top: 720,
    height: 600,
    style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' },
    children: [
      element({ tag: 'h2', text: 'Ofertas da semana', height: 40 }),
      element({ tag: 'button', text: 'Ver todas', height: 44 }),
    ],
  });
  const main = element({ tag: 'main', height: 1320, children: [hero, grid] });
  const wrapper = element({
    tag: 'div',
    id: '__next',
    height: 1320,
    children: [main],
  });
  const nav = element({
    tag: 'nav',
    height: 72,
    children: [
      element({ tag: 'a', text: 'Início', height: 32 }),
      element({ tag: 'a', text: 'Unidades', height: 32 }),
    ],
  });
  const body = element({ tag: 'body', height: 1392, children: [nav, wrapper] });
  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    getComputedStyle: globalThis.getComputedStyle,
  };
  const documentStub = {
    body,
    documentElement: { scrollHeight: 4200 },
    querySelector: (selector) => body.querySelector(selector),
    querySelectorAll: (selector) => body.querySelectorAll(selector),
  };
  globalThis.document = documentStub;
  globalThis.window = { scrollY: 0, innerHeight: 900 };
  globalThis.getComputedStyle = (node) => node.style;
  try {
    const { pageHeight, styles } = referenceOutline();
    assert.equal(pageHeight, 4200);
    // O wrapper do framework não pode virar a única faixa observada.
    assert.deepEqual(
      styles.sections.map((section) => section.identity),
      ['#hero.hero.dark', '.ofertas'],
    );
    assert.equal(styles.sections[0].heading, 'Fachada em primeiro plano');
    assert.equal(styles.sections[0].images, 1);
    assert.equal(styles.sections[0].background, 'rgb(10, 10, 10)');
    assert.equal(styles.sections[0].padding, '96px 64px');
    assert.equal(styles.sections[1].top, 720);
    assert.equal(styles.sections[1].columns, '1fr 1fr 1fr');
    assert.equal(styles.sections[1].buttons, 1);
    assert.deepEqual(styles.navigation, ['Início', 'Unidades']);
    assert.deepEqual(
      styles.typography.map((entry) => entry.role),
      ['h1', 'h2', 'a', 'button'],
    );
    assert.equal(styles.document.contentWidth, 1200);
    assert.ok(styles.palette.length > 0);
    assert.ok(styles.palette.every((color) => color.uses > 0));
  } finally {
    Object.assign(globalThis, previous);
  }
});
