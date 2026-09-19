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

for (const interrupted of [false, true])
  void test(`WorkflowAgent completa o build com chamada inválida${interrupted ? ' e retoma erro do provedor sem repetir efeitos' : ''}`, async () => {
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
            if (name === 'generate_project_image')
              return { ok: true, image: { id: 'saved-image' } };
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
      [
        'generate_project_image',
        {
          prompt: 'Fotografia editorial de madeira natural.',
          alt: 'Madeira',
          aspectRatio: '16:9',
        },
      ],
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
        const interruption = interrupted && index === 6;
        const callIndex = index - (interrupted && index > 6 ? 1 : 0);
        assert.deepEqual(options.providerOptions.gateway.only, ['google']);
        if (index > 0) {
          const lastCall = options.prompt
            .filter((message) => message.role === 'assistant')
            .flatMap((message) => message.content)
            .findLast((part) => part.type === 'tool-call');
          const previousIndex =
            interrupted && index === 7 ? index - 2 : index - 1;
          assert.equal(
            lastCall.providerOptions.google.thoughtSignature,
            `signature-${previousIndex}`,
            'A retomada mantém a assinatura e o provedor que a emitiu.',
          );
        }
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
        if (interrupted && index === 7) {
          assert.ok(
            options.prompt.some(
              (message) =>
                message.role === 'tool' &&
                message.content.some(
                  (part) =>
                    part.toolName === 'generate_project_image' &&
                    part.output?.value?.image?.id === 'saved-image',
                ),
            ),
          );
        }
        if (callIndex === calls.length - 1) {
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
          callIndex <= calls.length,
          'O fluxo não deve repetir os artefatos.',
        );
        const call = interruption ? null : calls[callIndex];
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            ...(interruption
              ? []
              : call
                ? [
                    {
                      type: 'tool-call',
                      toolCallId: `call-${index}`,
                      toolName: call[0],
                      input: JSON.stringify(call[1]),
                      providerMetadata: {
                        google: { thoughtSignature: `signature-${index}` },
                      },
                    },
                  ]
                : [
                    { type: 'text-start', id: 'final' },
                    {
                      type: 'text-delta',
                      id: 'final',
                      delta: 'Projeto validado.',
                    },
                    { type: 'text-end', id: 'final' },
                  ]),
            {
              type: 'finish',
              finishReason: {
                unified: interruption ? 'error' : call ? 'tool-calls' : 'stop',
                raw: undefined,
              },
              usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } },
            },
          ]),
        };
      },
    });
    const receipts = [];
    const started = [];
    const recoveries = [];
    const { streamStudioAgent } = loadModuleGraph('lib/studio/workflow.ts', {
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
      './usage': {
        beginStudioUsage: async (input) => started.push(input.step),
        recordStudioUsage: async (input) => receipts.push(...input.receipts),
      },
      './runs': {
        studioRunMayContinue: async () => true,
        nextStudioEvent: async (_runId, type, data) =>
          recoveries.push({ type, data }),
      },
    });
    const context = {
      runId: '00000000-0000-4000-8000-000000000001',
      projectId: '00000000-0000-4000-8000-000000000002',
      tenantId: '00000000-0000-4000-8000-000000000003',
      sandboxName: 'fixture',
      workflowRunId: 'wrun_fixture',
    };
    const result = await streamStudioAgent(
      {
        role: 'build',
        runId: context.runId,
        tenantId: context.tenantId,
        messages: [{ role: 'user', content: 'Crie a página da Oficina Demo.' }],
      },
      context,
    );
    assert.equal(result.error, undefined);
    assert.equal(result.finishReason, 'stop');
    assert.equal(result.steps.length, calls.length + 1 + Number(interrupted));
    assert.equal(result.totalUsage.totalTokens, 2 * result.steps.length);
    assert.deepEqual(
      started,
      Array.from({ length: result.steps.length }, (_, index) => index),
    );
    assert.deepEqual(
      receipts.map((receipt) => receipt.step),
      started,
    );
    assert.equal(recoveries.length, Number(interrupted));
    assert.deepEqual(
      executed.map((call) => call.name),
      calls
        .filter((_, index) => index !== calls.length - 2)
        .map((call) => call[0]),
    );
    assert.deepEqual(executed.at(-1).input, validationArtifact);
  });

for (const scenario of [
  'repeated-error',
  'content-filter',
  'budget',
  'cancelled',
  'thrown',
])
  void test(`retomada do modelo respeita ${scenario}`, async () => {
    let calls = 0;
    let recoveries = 0;
    const { streamStudioAgent } = loadModuleGraph('lib/studio/workflow.ts', {
      '@ai-sdk/workflow': {
        ...workflowSdk,
        WorkflowAgent: class {
          async stream() {
            calls++;
            if (scenario === 'thrown') throw new Error('HTTP indisponível');
            return {
              finishReason:
                scenario === 'content-filter' ? 'content-filter' : 'error',
              steps:
                scenario === 'budget'
                  ? Array.from({ length: 32 }, () => ({}))
                  : [],
              messages: [],
              totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            };
          }
        },
      },
      './runs': {
        studioRunMayContinue: async () => scenario !== 'cancelled',
        nextStudioEvent: async () => recoveries++,
      },
    });
    await assert.rejects(
      streamStudioAgent(
        { role: 'build', runId: 'run', tenantId: 'tenant', messages: [] },
        {},
      ),
    );
    assert.equal(calls, scenario === 'repeated-error' ? 3 : 1);
    assert.equal(recoveries, scenario === 'repeated-error' ? 2 : 0);
  });

void test('o orçamento de passos continua global depois da retomada no SDK real', async () => {
  const { studioTools: realTools, studioToolsContext } = loadModuleGraph(
    'lib/studio/tools.ts',
  );
  const tools = {
    list_project_files: {
      ...realTools.list_project_files,
      execute: async () => ({ files: [] }),
    },
  };
  const model = new MockLanguageModelV4({
    doStream: async () => {
      const index = model.doStreamCalls.length - 1;
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          ...(index === 3
            ? []
            : [
                {
                  type: 'tool-call',
                  toolCallId: `call-${index}`,
                  toolName: 'list_project_files',
                  input: '{}',
                },
              ]),
          {
            type: 'finish',
            finishReason: {
              unified: index === 3 ? 'error' : 'tool-calls',
              raw: undefined,
            },
            usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } },
          },
        ]),
      };
    },
  });
  const { streamStudioAgent } = loadModuleGraph('lib/studio/workflow.ts', {
    '@ai-sdk/workflow': {
      ...workflowSdk,
      WorkflowAgent: class extends workflowSdk.WorkflowAgent {
        constructor(settings) {
          super({ ...settings, model });
        }
      },
    },
    './tools': { studioTools: tools, studioToolsContext },
    './usage': {
      beginStudioUsage: async () => {},
      recordStudioUsage: async () => {},
    },
    './runs': {
      studioRunMayContinue: async () => true,
      nextStudioEvent: async () => {},
    },
  });
  const context = {
    runId: '00000000-0000-4000-8000-000000000001',
    projectId: '00000000-0000-4000-8000-000000000002',
    tenantId: '00000000-0000-4000-8000-000000000003',
    sandboxName: 'fixture',
    workflowRunId: 'workflow',
  };
  await assert.rejects(
    streamStudioAgent(
      {
        role: 'assistant',
        runId: context.runId,
        tenantId: context.tenantId,
        messages: [{ role: 'user', content: 'Inspecione o projeto.' }],
      },
      context,
    ),
    /limite de 12 etapas antes de concluir/,
  );
  assert.equal(model.doStreamCalls.length, 12);
});

void test('pedido de novo layout usa o agente de edição e passa da leitura para implementação sem onboarding', async () => {
  const { routeStudioTurn } = loadModuleGraph('lib/studio/routing.ts');
  const role = routeStudioTurn({
    status: 'published',
    draftCodeRevision: 'saved-code',
  });
  assert.equal(role, 'edit');
  assert.equal(
    routeStudioTurn({ status: 'failed', draftCodeRevision: null }),
    'build',
  );
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
  const reference = 'https://minatelsupermercados.com.br/brotas';
  const calls = [
    ['read_project_context', {}],
    ['inspect_visual_reference', { url: reference }],
    ...Array.from({ length: 13 }, (_, i) => [
      'read_project_file',
      { path: `components/Section${i}.tsx` },
    ]),
    [
      'write_project_file',
      {
        path: 'app/page.tsx',
        content:
          'export default function Page() { return <main>Novo layout</main>; }',
      },
    ],
    ['run_project_check', { command: 'typecheck' }],
    ['run_project_check', { command: 'build' }],
  ];
  const model = new MockLanguageModelV4({
    doStream: async (options) => {
      const index = model.doStreamCalls.length - 1;
      assert.deepEqual(
        options.tools.map((tool) => tool.name),
        Object.keys(tools),
      );
      assert.deepEqual(options.toolChoice, { type: 'auto' });
      const call = calls[index];
      assert.ok(index <= calls.length);
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          ...(call
            ? [
                {
                  type: 'tool-call',
                  toolCallId: `edit-${index}`,
                  toolName: call[0],
                  input: JSON.stringify(call[1]),
                },
              ]
            : [
                { type: 'text-start', id: 'final' },
                {
                  type: 'text-delta',
                  id: 'final',
                  delta: 'Layout alterado na prévia.',
                },
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
  const { streamStudioAgent } = loadModuleGraph('lib/studio/workflow.ts', {
    '@ai-sdk/workflow': {
      ...workflowSdk,
      WorkflowAgent: class extends workflowSdk.WorkflowAgent {
        constructor(settings) {
          super({ ...settings, model });
        }
      },
    },
    './tools': { studioTools: tools, studioToolsContext },
    './usage': {
      beginStudioUsage: async () => {},
      recordStudioUsage: async () => {},
    },
  });
  const context = {
    runId: '00000000-0000-4000-8000-000000000001',
    projectId: '00000000-0000-4000-8000-000000000002',
    tenantId: '00000000-0000-4000-8000-000000000003',
    sandboxName: 'fixture',
    workflowRunId: 'workflow',
  };
  const result = await streamStudioAgent(
    {
      role,
      runId: context.runId,
      tenantId: context.tenantId,
      messages: [
        { role: 'user', content: `eu quero copiar esse layout ${reference}` },
      ],
    },
    context,
  );
  assert.equal(result.finishReason, 'stop');
  assert.equal(result.steps.length, calls.length + 1);
  assert.deepEqual(
    executed.map(({ name, input }) => [name, input]),
    calls,
  );
});

/** Um pedido grande de front-end passa de um segmento do agente. */
function continuationFixture(toolName) {
  const { studioTools: realTools, studioToolsContext } = loadModuleGraph(
    'lib/studio/tools.ts',
  );
  const tools = Object.fromEntries(
    Object.entries(realTools).map(([name, tool]) => [
      name,
      {
        ...tool,
        toModelOutput: undefined,
        execute: async () => ({ ok: true }),
      },
    ]),
  );
  const model = new MockLanguageModelV4({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        {
          type: 'tool-call',
          toolCallId: `call-${model.doStreamCalls.length}`,
          toolName,
          input: JSON.stringify(
            toolName === 'write_project_file'
              ? { path: 'app/page.tsx', content: 'export default () => null;' }
              : {},
          ),
        },
        {
          type: 'finish',
          finishReason: { unified: 'tool-calls', raw: undefined },
          usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } },
        },
      ]),
    }),
  });
  const events = [];
  const { streamStudioAgent } = loadModuleGraph('lib/studio/workflow.ts', {
    '@ai-sdk/workflow': {
      ...workflowSdk,
      WorkflowAgent: class extends workflowSdk.WorkflowAgent {
        constructor(settings) {
          super({ ...settings, model });
        }
      },
    },
    './tools': { studioTools: tools, studioToolsContext },
    './usage': {
      beginStudioUsage: async () => {},
      recordStudioUsage: async () => {},
    },
    './runs': {
      studioRunMayContinue: async () => true,
      nextStudioEvent: async (_runId, type, data) =>
        events.push({ type, data }),
    },
  });
  return { model, events, streamStudioAgent };
}

const continuationContext = {
  runId: '00000000-0000-4000-8000-000000000001',
  projectId: '00000000-0000-4000-8000-000000000002',
  tenantId: '00000000-0000-4000-8000-000000000003',
  sandboxName: 'fixture',
  workflowRunId: 'workflow',
};

void test('a edição continua em novos segmentos enquanto escreve, até o teto do turno', async () => {
  const fixture = continuationFixture('write_project_file');
  await assert.rejects(
    fixture.streamStudioAgent(
      {
        role: 'edit',
        runId: continuationContext.runId,
        tenantId: continuationContext.tenantId,
        messages: [{ role: 'user', content: 'Copie o layout inteiro.' }],
      },
      continuationContext,
    ),
    /limite de 150 etapas antes de concluir/,
  );
  assert.equal(fixture.model.doStreamCalls.length, 150);
  assert.deepEqual(
    fixture.events.map((event) => event.type),
    ['model.continuing', 'model.continuing', 'model.continuing'],
  );
  assert.deepEqual(fixture.events.at(-1).data, {
    completedSteps: 144,
    budget: 150,
    completedSegments: 3,
  });
});

void test('dois segmentos sem escrita nem verificação encerram o turno antes do teto', async () => {
  const fixture = continuationFixture('list_project_files');
  await assert.rejects(
    fixture.streamStudioAgent(
      {
        role: 'edit',
        runId: continuationContext.runId,
        tenantId: continuationContext.tenantId,
        messages: [{ role: 'user', content: 'Copie o layout inteiro.' }],
      },
      continuationContext,
    ),
    /96 etapas sem escrever no projeto/,
  );
  assert.equal(fixture.model.doStreamCalls.length, 96);
  assert.equal(fixture.events.length, 1);
});

void test('a parada do provedor entrega causa verificável em vez de só "error"', () => {
  const { segmentDiagnosis, providerErrorDetail } = loadModuleGraph(
    'lib/studio/workflow.ts',
  );
  // Caso observado: o provedor emitiu parte de erro com a mensagem do Gemini.
  assert.equal(
    segmentDiagnosis({
      error: new Error('Invalid thought signature.'),
      steps: [{}],
    }),
    'Invalid thought signature.',
  );
  // Caso observado no run 6d97da97: finishReason=error sem parte de erro.
  // O rastro do provedor no último passo é a única pista restante.
  assert.equal(
    segmentDiagnosis({
      steps: [
        { rawFinishReason: 'MALFORMED_FUNCTION_CALL', warnings: undefined },
        {
          rawFinishReason: 'OTHER',
          warnings: [{ type: 'other', message: 'thought signature missing' }],
        },
      ],
    }),
    'rawFinishReason=OTHER | warnings: thought signature missing',
  );
  // Sem rastro nenhum, não inventa causa.
  assert.equal(segmentDiagnosis({ steps: [{}] }), undefined);
  assert.equal(segmentDiagnosis({ steps: [] }), undefined);
  assert.equal(providerErrorDetail({ error: 'recusado' }), 'recusado');
  assert.equal(providerErrorDetail(undefined), undefined);
});

void test('a retomada nomeia a chamada ilegivel em vez de repetir o empurrao generico', () => {
  const { segmentDiagnosis, recoveryInstruction } = loadModuleGraph(
    'lib/studio/workflow.ts',
  );
  // Observado no run 58c25dee: o Gemini nao conseguiu ler a propria chamada.
  const detail = segmentDiagnosis({
    steps: [
      {
        rawFinishReason: 'MALFORMED_FUNCTION_CALL',
        toolCalls: [
          { toolName: 'write_project_file' },
          { toolName: 'write_project_file' },
        ],
      },
    ],
  });
  assert.equal(
    detail,
    'rawFinishReason=MALFORMED_FUNCTION_CALL | tentou: write_project_file',
  );
  const nudge = recoveryInstruction(detail);
  assert.match(nudge, /nao pode ser lida pelo provedor|n\u00e3o p\u00f4de ser lida pelo provedor/);
  assert.match(nudge, /edit_project_file/);
  assert.doesNotMatch(nudge, /Faca uma chamada de ferramenta por vez|Fa\u00e7a uma chamada de ferramenta por vez/);
  // Outra causa mantem a orientacao anterior, sem inventar diagnostico.
  const outra = recoveryInstruction('rawFinishReason=OTHER');
  assert.doesNotMatch(outra, /serializa/);
  assert.match(outra, /uma chamada de ferramenta por vez/);
  assert.equal(recoveryInstruction(undefined), outra);
});
