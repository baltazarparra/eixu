import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModuleGraph } from './helpers/load-module.mjs';

for (const outcome of ['repaired', 'invalid', 'cancelled'])
  void test(`gate final devolve evidência ao agente e limita a correção: ${outcome}`, async () => {
    const agents = [];
    const started = [];
    const receipts = [];
    const events = [];
    const finished = [];
    const queries = [];
    let checkpoints = 0;
    let closed = false;
    const feedback =
      'build falhou no gate final. Event handlers cannot be passed to Client Component props.';
    const subject = loadModuleGraph('lib/studio/workflow.ts', {
      '@ai-sdk/workflow': {
        WorkflowAgent: class {
          constructor(settings) {
            this.settings = settings;
          }
          async stream(options) {
            agents.push({ settings: this.settings, options });
            const step = {
              stepNumber: 0,
              model: { modelId: this.settings.model },
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            };
            await options.onStepStart(step);
            await options.onStepEnd(step);
            return {
              steps: [step],
              totalUsage: step.usage,
              finishReason: 'stop',
              messages: [
                { role: 'system', content: 'instruções' },
                ...options.messages,
                { role: 'assistant', content: 'Projeto atualizado.' },
              ],
            };
          }
        },
        createModelCallToUIChunkTransform: () => new TransformStream(),
      },
      ai: {
        isStepCount: (count) => count,
        readUIMessageStream: async function* () {
          yield {
            role: 'assistant',
            parts: [{ type: 'text', text: 'Projeto atualizado.' }],
          };
        },
      },
      workflow: {
        getWorkflowMetadata: () => ({ workflowRunId: 'workflow' }),
        getWritable: () => ({}),
      },
      'workflow/api': {
        getRun: () => ({
          getReadable: () =>
            new ReadableStream({
              start(controller) {
                controller.close();
              },
            }),
        }),
      },
      '@/lib/db': {
        db: () => async (parts) => {
          queries.push(parts.join('?'));
          return parts.join('?').includes('select status from studio_runs')
            ? [
                {
                  status:
                    outcome === 'cancelled' ? 'cancel_requested' : 'running',
                },
              ]
            : [];
        },
      },
      './runs': {
        attachWorkflowRun: async () => true,
        studioRunMayContinue: async () => outcome !== 'cancelled',
        nextStudioEvent: async (_run, type, data) =>
          events.push({ type, data }),
        finishStudioRun: async (input) => {
          finished.push(input);
          return true;
        },
      },
      './messages': { persistStudioMessage: async () => true },
      './tools': { studioTools: {}, studioToolsContext: (value) => value },
      './usage': {
        beginStudioUsage: async (input) => started.push(input),
        recordStudioUsage: async (input) => receipts.push(...input.receipts),
      },
      './sandbox': { prepareStudioWorkspaceForRun: async () => {} },
      './checkpoint': {
        checkpointStudioProject: async () => {
          checkpoints++;
          return checkpoints === 2 && outcome === 'repaired'
            ? { ok: true }
            : { ok: false, command: 'build', error: feedback };
        },
      },
      './workflow-stream': {
        closeStudioStreamStep: async () => {
          closed = true;
        },
      },
    });
    const turn = subject.studioTurnWorkflow({
      runId: 'run',
      projectId: 'project',
      tenantId: 'tenant',
      tenant: { slug: 'fixture', name: 'Fixture' },
      sandboxName: 'sandbox',
      responseMessageUid: 'response',
      role: 'build',
      messages: [{ role: 'user', content: 'Crie o site.' }],
      operator: { id: 'user', name: 'Fixture', login: 'fixture' },
      autoPublish: false,
    });
    if (outcome === 'repaired') assert.equal((await turn).status, 'succeeded');
    else
      await assert.rejects(
        turn,
        outcome === 'cancelled'
          ? /cancelada antes da correção/
          : /após a tentativa de correção/,
      );
    assert.equal(closed, true);
    assert.equal(checkpoints, outcome === 'cancelled' ? 1 : 2);
    assert.equal(agents.length, outcome === 'cancelled' ? 1 : 2);
    assert.equal(
      finished[0].status,
      outcome === 'repaired'
        ? 'succeeded'
        : outcome === 'cancelled'
          ? 'cancelled'
          : 'failed',
    );
    if (outcome !== 'cancelled') {
      assert.equal(
        agents[1].options.messages.some((message) => message.role === 'system'),
        false,
      );
      assert.ok(agents[1].options.messages.at(-1).content.includes(feedback));
      assert.equal(agents[1].settings.stopWhen, 20);
      assert.deepEqual(agents[1].settings.activeTools, [
        'list_project_files',
        'read_project_file',
        'write_project_file',
        'write_content_contract',
        'run_project_check',
        'record_artifact',
      ]);
      assert.deepEqual(
        started.map(({ step, role }) => [step, role]),
        [
          [0, 'build'],
          [1, 'diagnostic'],
        ],
      );
      assert.deepEqual(
        receipts.slice(0, 2).map(({ step, role }) => [step, role]),
        [
          [0, 'build'],
          [1, 'diagnostic'],
        ],
      );
      assert.equal(events[0].type, 'validation.repairing');
    }
    if (outcome !== 'repaired')
      assert.ok(
        queries.some(
          (query) =>
            query.includes('update studio_projects project set') &&
            query.includes('not exists'),
        ),
      );
  });
