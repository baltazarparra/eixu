/** Comparação em memória: nenhuma ferramenta acessa banco, Blob ou publicação. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { convertToModelMessages, generateText, isStepCount } from 'ai';
import { createJiti } from 'jiti';
const j = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const { contextMessages } = await j.import('../lib/ai/context.ts');
const { productModel, modelSettings } = await j.import('../lib/ai/models.ts');
const { gatewayOptions } = await j.import('../lib/ai/usage.ts');
const { systemPrompt } = await j.import('../lib/taste/prompt.ts');
const { buildTools } = await j.import('../lib/ai/tools.ts');
const tenant = {
  id: 'eval-admin-cost',
  slug: 'atelier-teste',
  name: 'Atelier de teste',
  brief: {
    intake: {
      offer: 'Orientação sobre materiais',
      constraints: ['Não alterar o rodapé.'],
    },
  },
  brand: {},
  dials: { variance: 5, density: 5, motion: 2 },
  imageGuide: {},
  whatsapp: null,
};
const block = (id, type, props) => ({ id, type, props });
const page = {
  slug: '/',
  type: 'page',
  title: 'Início',
  seo: { title: 'Atelier de teste' },
  blocks: [
    block('nav', 'nav.bar', {
      logoText: tenant.name,
      logoHeight: 28,
      links: [{ label: 'Materiais', href: '/materiais' }],
    }),
    ...Array.from({ length: 8 }, (_, n) =>
      block(`texto-${n}`, 'editorial.text', {
        title: `Etapa ${n}`,
        body: 'Materiais devem ser escolhidos a partir do uso previsto, das dimensões e das referências do projeto. Confira as características antes de definir a proposta. '.repeat(
          12,
        ),
      }),
    ),
    block('footer', 'footer.compact', {
      logoText: tenant.name,
      logoHeight: 28,
    }),
  ],
};
const conversation = [
  {
    id: 'u1',
    role: 'user',
    parts: [
      {
        type: 'text',
        text: 'Confira o site. Na próxima alteração, preserve o rodapé com 28px.',
      },
    ],
  },
  {
    id: 'a1',
    role: 'assistant',
    parts: [
      {
        type: 'tool-get_page',
        toolCallId: 'previous-read',
        state: 'output-available',
        input: { page: '' },
        output: page,
      },
      { type: 'text', text: 'O cabeçalho e o rodapé usam altura de 28px.' },
    ],
  },
  {
    id: 'u2',
    role: 'user',
    parts: [
      {
        type: 'text',
        text: 'Aumente só o logo do cabeçalho para 52px. Preserve o restante.',
      },
    ],
  },
];
const before = await convertToModelMessages(conversation);
const after = await convertToModelMessages(contextMessages(conversation));
const report = {
  model: productModel(),
  beforeChars: JSON.stringify(before).length,
  afterChars: JSON.stringify(after).length,
  runs: [],
};
if (process.argv.includes('--live')) {
  const instructions = systemPrompt(
    tenant,
    '- / (page, 10 blocos, publicada): Início',
    '/',
  );
  for (const [label, messages, cached] of [
    ['antes', before, false],
    ['depois', after, true],
    ['depois-cache', after, true],
  ]) {
    const current = structuredClone(page);
    const changes = [];
    const base = buildTools(tenant);
    const tools = Object.fromEntries(
      Object.entries(base).map(([name, definition]) => [
        name,
        {
          ...definition,
          execute: async () => ({
            error:
              'Esta avaliação só permite ler a home e editar a altura do logo do cabeçalho em memória.',
          }),
        },
      ]),
    );
    tools.get_page.execute = async () => current;
    tools.update_block.execute = async (input) => {
      const selector = input.block;
      const target = current.blocks.find(
        (item) =>
          item.id === selector ||
          item.type === selector ||
          item.type.split('.')[0] === selector,
      );
      if (!target) return { error: 'Bloco não encontrado. Leia a página.' };
      target.props = { ...target.props, ...input.props };
      changes.push({ block: target.id, props: input.props });
      return { ok: true };
    };
    const started = Date.now();
    const result = await generateText({
      model: report.model,
      instructions,
      messages,
      tools,
      ...(cached
        ? { providerOptions: gatewayOptions(tenant.id, 'eval-admin') }
        : {}),
      ...modelSettings('livre'),
      maxRetries: 0,
      stopWhen: isStepCount(4),
      abortSignal: AbortSignal.timeout(90_000),
    });
    assert.equal(
      current.blocks[0].props.logoHeight,
      52,
      'O cabeçalho deve receber 52px.',
    );
    const expected = structuredClone(page);
    expected.blocks[0].props.logoHeight = 52;
    assert.deepEqual(
      current,
      expected,
      'Nada além da altura do cabeçalho pode mudar.',
    );
    const costs = result.steps
      .map((step) => step.providerMetadata?.gateway?.cost)
      .map((cost) => (cost === undefined ? null : Number(cost)));
    const run = {
      label,
      elapsedMs: Date.now() - started,
      usage: result.usage,
      steps: result.steps.length,
      calls: result.steps.flatMap((step) =>
        step.toolCalls.map((call) => call.toolName),
      ),
      costUsd: costs.every((cost) => cost !== null && Number.isFinite(cost))
        ? costs.reduce((a, b) => a + b, 0)
        : null,
      correct: true,
      changes,
    };
    report.runs.push(run);
    console.log(
      JSON.stringify({
        label,
        ...run,
        usage: { ...run.usage, raw: undefined },
      }),
    );
  }
}
await mkdir('outputs/admin-review', { recursive: true });
await writeFile(
  `outputs/admin-review/token-eval${process.argv.includes('--live') ? '' : '-dry'}.json`,
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    beforeChars: report.beforeChars,
    afterChars: report.afterChars,
    reduction: (1 - report.afterChars / report.beforeChars) * 100,
    liveRuns: report.runs.length,
  }),
);
