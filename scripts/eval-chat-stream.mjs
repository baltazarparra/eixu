/** Exercita POST, streaming, ferramentas e persistência textual com I/O em memória. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createJiti } from 'jiti';
import { loadModule } from '../tests/helpers/load-module.mjs';
import { memoryHarness } from './lib/harness-memory.mjs';

if (!process.argv.includes('--live')) {
  console.log(
    'Uso: node --env-file=.env.local scripts/eval-chat-stream.mjs --live. Modelo pago; nenhuma escrita remota.',
  );
  process.exit(0);
}
const j = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const { productModel } = await j.import('../lib/ai/models.ts');
const tenant = {
  id: 'eval-stream',
  slug: 'eval-stream',
  name: 'Atelier de teste',
  brief: { intake: { offer: 'Orientação sobre materiais' } },
  brand: {},
  dials: { variance: 5, density: 5, motion: 2 },
  imageGuide: {},
  contacts: {},
  whatsapp: null,
  contactEmail: null,
};
const state = await memoryHarness(tenant, []);
state.pages.push({
  id: 'page-stream',
  tenantId: tenant.id,
  slug: '',
  type: 'page',
  title: 'Início',
  seo: { title: 'Atelier de teste' },
  meta: {},
  publishedBlocks: null,
  blocks: [
    {
      id: 'nav',
      type: 'nav.bar',
      props: { logoText: tenant.name, logoHeight: 28, links: [] },
    },
    {
      id: 'texto',
      type: 'editorial.text',
      props: {
        title: 'Escolhas do projeto',
        body: 'Materiais devem ser escolhidos a partir do uso previsto, das dimensões e das referências do projeto. Confira as características antes de definir a proposta.',
      },
    },
    {
      id: 'footer',
      type: 'footer.compact',
      props: { logoText: tenant.name, logoHeight: 28 },
    },
  ],
});
const before = structuredClone(state.pages);
const persisted = [];
const { POST } = await loadModule('app/api/chat/route.ts', {
  '@/lib/auth': { isAuthenticated: async () => true },
  '@/lib/db': {
    db:
      () =>
      async (_parts, ...values) => {
        persisted.push(values);
        return [];
      },
  },
  '@/lib/tenant-queries': {
    getTenantBySlug: async () => structuredClone(tenant),
    listPages: async () => structuredClone(state.pages),
  },
  '@/lib/images/queries': { listImages: async () => [] },
  '@/lib/ai/tools': {
    buildTools: (_tenant, context) => state.buildTools(context),
  },
});
const started = Date.now();
const response = await POST(
  new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      tenant: tenant.slug,
      page: '',
      messages: [
        {
          id: 'operator',
          role: 'user',
          parts: [
            {
              type: 'text',
              text: 'Aumente só o logo do cabeçalho para 52px. Preserve todos os demais blocos e propriedades, incluindo o rodapé. Registre pendências anteriores sem corrigi-las neste pedido.',
            },
          ],
        },
      ],
    }),
  }),
);
assert.equal(response.status, 200);
const sse = await response.text();
const events = sse
  .split('\n')
  .filter((line) => line.startsWith('data: ') && !line.includes('[DONE]'))
  .map((line) => JSON.parse(line.slice(6)));
assert.equal(
  events.some((event) => event.type === 'error'),
  false,
);
assert.ok(events.some((event) => event.type === 'finish'));
assert.ok(events.some((event) => event.type === 'text-delta'));
const expected = structuredClone(before);
expected[0].blocks[0].props.logoHeight = 52;
assert.deepEqual(state.pages, expected);
assert.ok(
  persisted.some(
    (values) =>
      values[1] ===
      'Aumente só o logo do cabeçalho para 52px. Preserve todos os demais blocos e propriedades, incluindo o rodapé. Registre pendências anteriores sem corrigi-las neste pedido.',
  ),
);
assert.equal(
  persisted.length,
  2,
  'Mensagem do operador e resposta final persistidas',
);
const usage = events.find((event) => event.messageMetadata?.usage)
  ?.messageMetadata.usage;
assert.equal(usage?.model, productModel());
assert.ok(usage.reasoningTokens > 0);
const report = {
  passed: true,
  model: productModel(),
  durationMs: Date.now() - started,
  usage,
  scope:
    'POST e stream reais; sessão, dados e persistência em memória; só logo do cabeçalho alterado.',
  events: events.map((event) => ({
    type: event.type,
    toolName: event.toolName,
  })),
  persistedMessages: persisted.length,
};
await mkdir('outputs/harness', { recursive: true });
await writeFile(
  'outputs/harness/chat-stream.json',
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
