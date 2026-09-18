import assert from 'node:assert/strict';
import test from 'node:test';
import * as workflowSdk from '@ai-sdk/workflow';
import { convertArrayToReadableStream, MockLanguageModelV4 } from 'ai/test';
import { loadModuleGraph } from './helpers/load-module.mjs';

const contextArtifact = {
  kind: 'context',
  payload: {
    summary: 'Oficina Demo restaura móveis.',
    tone: { voice: 'Direta.', traits: ['clara'], avoid: [] },
    facts: [
      {
        statement: 'A oficina restaura móveis.',
        source: { kind: 'operator', location: '/dados' },
        status: 'confirmed',
      },
    ],
    inferences: [],
    gaps: [],
    constraints: [],
    sitePlan: [{ slug: '/', purpose: 'Apresentação.', content: ['contato'] }],
  },
};
const artArtifact = {
  kind: 'art_direction',
  payload: {
    concept: 'Editorial artesanal.',
    reference: {
      url: 'https://example.com',
      source: 'operator',
      observations: ['Hierarquia assimétrica.', 'Fotografia ampla.'],
    },
    logo: {
      observations: ['Marca tipográfica.'],
      handling: 'Preservar a marca.',
    },
    layout: 'Uma coluna editorial.',
    typography: 'Serifada nos títulos.',
    palette: [
      { role: 'fundo', value: '#ffffff', use: 'Página.' },
      { role: 'texto', value: '#111111', use: 'Leitura.' },
    ],
    imagery: 'Fotografia de madeira.',
    rhythm: 'Espaçamento amplo.',
    motion: {
      principles: ['Transições curtas.'],
      reducedMotion: 'Sem animação.',
    },
    mobile: 'Coluna única.',
    avoid: ['Cards decorativos.'],
  },
};
const validationArtifact = {
  kind: 'validation',
  payload: {
    summary: 'Comandos e marca conferidos.',
    ready: true,
    limitations: [],
    checks: [
      {
        kind: 'command',
        command: 'typecheck',
        status: 'passed',
        evidence: 'exit 0',
      },
      {
        kind: 'command',
        command: 'build',
        status: 'passed',
        evidence: 'exit 0',
      },
      {
        kind: 'manual',
        name: 'Marca',
        status: 'passed',
        evidence: 'Logo preservado.',
      },
    ],
  },
};

void test('WorkflowAgent libera escrita e checks após a direção de arte e recupera uma chamada inválida', async () => {
  const { studioTools: realTools, studioToolsContext } = loadModuleGraph(
    'lib/studio/tools.ts',
  );
  const executed = [];
  const tools = Object.fromEntries(
    Object.entries(realTools).map(([name, tool]) => [
      name,
      {
        ...tool,
        toModelOutput: undefined,
        execute: async (input) => {
          executed.push({ name, input });
          return { ok: true };
        },
      },
    ]),
  );
  const invalidValidation = structuredClone(validationArtifact);
  invalidValidation.payload.checks[2].kind = 'brand';
  const calls = [
    ['read_project_context', {}],
    ['read_official_site', {}],
    ['record_artifact', contextArtifact],
    ['inspect_visual_reference', {}],
    ['record_artifact', artArtifact],
    ['list_project_files', {}],
    [
      'write_project_file',
      {
        path: 'app/page.tsx',
        content:
          'export default function Page() { return <main>Oficina Demo</main>; }',
      },
    ],
    [
      'write_content_contract',
      {
        contract: {
          version: 1,
          pages: [
            {
              slug: '',
              label: 'Início',
              sections: [
                {
                  id: 'hero',
                  label: 'Abertura',
                  fields: [
                    {
                      key: 'hero.title',
                      label: 'Título',
                      type: 'text',
                      value: 'Oficina Demo',
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    ],
    ['run_project_check', { command: 'typecheck' }],
    ['run_project_check', { command: 'build' }],
    ['record_artifact', invalidValidation],
    ['record_artifact', validationArtifact],
  ];
  const model = new MockLanguageModelV4({
    doStream: async (options) => {
      const index = model.doStreamCalls.length - 1;
      if (index < 5) {
        assert.deepEqual(
          options.tools.map((tool) => tool.name),
          [calls[index][0]],
        );
        assert.deepEqual(options.toolChoice, {
          type: 'tool',
          toolName: calls[index][0],
        });
      } else {
        assert.deepEqual(
          options.tools.map((tool) => tool.name),
          Object.keys(tools),
        );
        assert.deepEqual(options.toolChoice, { type: 'auto' });
      }
      assert.equal(options.maxOutputTokens, index < 3 ? 16_384 : 49_152);
      if (index === calls.length - 1) {
        assert.ok(
          options.prompt.some(
            (message) =>
              message.role === 'tool' &&
              message.content.some((part) =>
                part.output?.type?.startsWith('error-'),
              ),
          ),
        );
      }
      assert.ok(
        index <= calls.length,
        'O fluxo não deve repetir os artefatos.',
      );
      const call = calls[index];
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          ...(call
            ? [
                {
                  type: 'tool-call',
                  toolCallId: `call-${index}`,
                  toolName: call[0],
                  input: JSON.stringify(call[1]),
                },
              ]
            : [
                { type: 'text-start', id: 'final' },
                { type: 'text-delta', id: 'final', delta: 'Projeto validado.' },
                { type: 'text-end', id: 'final' },
              ]),
          {
            type: 'finish',
            finishReason: {
              unified: call ? 'tool-calls' : 'stop',
              raw: undefined,
            },
            usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } },
          },
        ]),
      };
    },
  });
  const { createStudioAgent } = loadModuleGraph('lib/studio/workflow.ts', {
    '@ai-sdk/workflow': {
      ...workflowSdk,
      WorkflowAgent: class extends workflowSdk.WorkflowAgent {
        constructor(settings) {
          super({
            ...settings,
            model,
            prepareStep: async (input) => ({
              ...(await settings.prepareStep(input)),
              model,
            }),
          });
        }
      },
    },
    './tools': { studioTools: tools, studioToolsContext },
  });
  const result = await createStudioAgent('build', {
    runId: '00000000-0000-4000-8000-000000000001',
    projectId: '00000000-0000-4000-8000-000000000002',
    tenantId: '00000000-0000-4000-8000-000000000003',
    sandboxName: 'fixture',
    workflowRunId: 'wrun_fixture',
  }).stream({
    messages: [{ role: 'user', content: 'Crie a página da Oficina Demo.' }],
  });
  assert.equal(result.error, undefined);
  assert.equal(result.finishReason, 'stop');
  assert.equal(result.steps.length, calls.length + 1);
  assert.deepEqual(
    executed.map((call) => call.name),
    calls
      .filter((_, index) => index !== calls.length - 2)
      .map((call) => call[0]),
  );
  assert.deepEqual(executed.at(-1).input, validationArtifact);
});
