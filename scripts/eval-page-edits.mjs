/** Chamadas reais, executores reais e páginas sintéticas em memória. Sem Neon/Blob/publicação. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createJiti } from 'jiti';
import {
  editPages,
  pageEditFixture,
} from '../tests/helpers/page-edit-fixture.mjs';
const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
const { siteAgent } = await j.import('../lib/ai/agent.ts');
const { productModel } = await j.import('../lib/ai/models.ts');
const { usageRecord, sumGatewayCosts } = await j.import('../lib/ai/usage.ts');
if (!process.argv.includes('--live')) {
  console.log(
    'Use npm run eval:edits -- --live [--case=text|nested|color|insert|move|ambiguous]. Modelo configurado, fixture sintética, executores reais; nenhuma gravação remota.',
  );
  process.exit(0);
}
const cases = [
  {
    id: 'text',
    text: 'Troque o texto "Escolha com calma." por "Compare os acabamentos.".',
    check: (pages) => {
      const expected = editPages();
      expected[0].blocks[2].props.body =
        expected[0].blocks[2].props.body.replace(
          'Escolha com calma.',
          'Compare os acabamentos.',
        );
      assert.deepEqual(pages, expected);
    },
  },
  {
    id: 'nested',
    text: 'Na segunda pergunta do bloco de dúvidas, troque a pergunta para "O que considerar no ambiente?". Preserve a resposta.',
    check: (pages) => {
      const expected = editPages();
      expected[0].blocks[3].props.items[1].q = 'O que considerar no ambiente?';
      assert.deepEqual(pages, expected);
    },
  },
  {
    id: 'color',
    text: 'Altere só o fundo do bloco "Como escolher" para #173f54.',
    check: (pages) => {
      const expected = editPages();
      expected[0].blocks[2].props.presentation.background = '#173f54';
      assert.deepEqual(pages, expected);
    },
  },
  {
    id: 'insert',
    text: 'Adicione abaixo do footer um bloco de texto com título "Cuidados com materiais" e texto "Considere as características do material antes de escolher os produtos de limpeza.". Preserve o restante.',
    check: (pages) => {
      const expected = editPages();
      const added = pages[0].blocks.at(-1);
      assert.equal(added.type, 'editorial.text');
      assert.equal(added.props.title, 'Cuidados com materiais');
      assert.equal(
        added.props.body,
        'Considere as características do material antes de escolher os produtos de limpeza.',
      );
      expected[0].blocks.push(added);
      assert.deepEqual(pages, expected);
    },
  },
  {
    id: 'move',
    text: 'Mova o bloco de dúvidas para logo antes de "Como escolher".',
    check: (pages) => {
      const expected = editPages();
      const [faq] = expected[0].blocks.splice(3, 1);
      expected[0].blocks.splice(2, 0, faq);
      assert.deepEqual(pages, expected);
    },
  },
  {
    id: 'ambiguous',
    text: 'Troque "Ver materiais" por "Ver opções".',
    check: (pages, result) => {
      assert.deepEqual(pages, editPages());
      assert.ok(result.text.trim().length > 0);
      assert.match(result.text, /\?|qual|cabeçalho|botão|duas|amb[oa]s/i);
    },
  },
];
const selected = process.argv
  .find((arg) => arg.startsWith('--case='))
  ?.slice(7);
if (selected && !cases.some((c) => c.id === selected))
  throw new Error('Caso desconhecido.');
const directory = `outputs/page-edits/${Date.now()}`;
await mkdir(directory, { recursive: true });
const report = {
  model: productModel(),
  scope: 'Páginas sintéticas em memória; sem autenticação/Neon/Blob reais.',
  runs: [],
};
for (const scenario of cases.filter((c) => !selected || c.id === selected)) {
  const f = await pageEditFixture(scenario.text);
  const trace = [];
  const started = Date.now();
  const agent = siteAgent({
    tenantId: f.tenant.id,
    tools: f.tools,
    instructions: f.instructions,
  });
  try {
    const result = await agent.generate({
      prompt: scenario.text,
      onStepEnd: (step) => {
        trace.push({
          calls: step.toolCalls,
          results: step.toolResults,
          text: step.text,
        });
        console.log(
          JSON.stringify({
            case: scenario.id,
            step: trace.length,
            tools: step.toolCalls.map((call) => call.toolName),
            rejected: step.content.filter((part) => part.type === 'tool-error')
              .length,
          }),
        );
      },
    });
    scenario.check(f.pages, result);
    const run = {
      case: scenario.id,
      correct: true,
      ...usageRecord(
        result.usage,
        report.model,
        'livre',
        result.steps.length,
        started,
      ),
      costUsd: sumGatewayCosts(
        result.steps.map((step) => step.providerMetadata?.gateway?.cost),
      ),
      calls: result.steps.flatMap((step) =>
        step.toolCalls.map((call) => call.toolName),
      ),
      writes: f.writes.length,
      text: result.text,
    };
    report.runs.push(run);
    console.log(JSON.stringify(run));
  } catch (error) {
    report.runs.push({
      case: scenario.id,
      correct: false,
      elapsedMs: Date.now() - started,
      error: error instanceof Error ? error.message : 'Falha',
    });
    console.error(
      JSON.stringify({
        case: scenario.id,
        correct: false,
        error: error instanceof Error ? error.name : 'Falha',
      }),
    );
    process.exitCode = 1;
  }
  await writeFile(
    `${directory}/${scenario.id}.json`,
    JSON.stringify({ pages: f.pages, trace }, null, 2),
  );
  await writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2));
}
console.log(`Relatório: ${directory}/report.json`);
