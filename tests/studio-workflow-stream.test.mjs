import assert from 'node:assert/strict';
import test from 'node:test';
import * as workflowSdk from '@ai-sdk/workflow';
import { loadModuleGraph } from './helpers/load-module.mjs';

const { closeStudioStreamStep } = loadModuleGraph(
  'lib/studio/workflow-stream.ts',
);
const { studioUIMessageStream } = loadModuleGraph('lib/studio/ui-stream.ts', {
  '@ai-sdk/workflow': workflowSdk,
});

function modelParts() {
  return [
    { type: 'text-start', id: 'text' },
    { type: 'text-delta', id: 'text', text: 'Turno concluído.' },
    { type: 'text-end', id: 'text' },
  ];
}

function readable(parts) {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
}

for (const failure of [false, true])
  void test(`workflow usa step para fechar stream e persiste ${failure ? 'falha' : 'sucesso'}`, async () => {
    const output = modelParts();
    const messages = [];
    const finished = [];
    let closed = false;
    const writable = new WritableStream({
      write(part) {
        output.push(part);
      },
      close() {
        closed = true;
      },
    });
    const workflowHandle = {
      getWriter() {
        throw new Error('getWriter proibido no workflow');
      },
    };
    const subject = loadModuleGraph('lib/studio/workflow.ts', {
      '@ai-sdk/workflow': {
        ...workflowSdk,
        WorkflowAgent: class {
          async stream() {
            return {
              totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              steps: [],
              finishReason: 'stop',
            };
          }
        },
      },
      workflow: {
        getWorkflowMetadata: () => ({ workflowRunId: 'workflow' }),
        getWritable: () => workflowHandle,
      },
      'workflow/api': {
        getRun: () => ({
          getReadable: () => {
            assert.equal(closed, true);
            return readable(output);
          },
        }),
      },
      '@/lib/db': {
        db: () => async (parts) =>
          parts.join('?').includes('select status from studio_runs')
            ? [{ status: 'running' }]
            : [],
      },
      './runs': {
        attachWorkflowRun: async () => true,
        finishStudioRun: async (input) => {
          finished.push(input);
          return true;
        },
      },
      './messages': {
        persistStudioMessage: async ({ message }) => {
          messages.push(message);
          return true;
        },
      },
      './tools': { studioTools: {}, studioToolsContext: (value) => value },
      './usage': {
        beginStudioUsage: async () => {},
        recordStudioUsage: async () => {},
      },
      './sandbox': { prepareStudioWorkspaceForRun: async () => {} },
      './checkpoint': {
        checkpointStudioProject: async () => {
          if (failure) throw new Error('Gate recusado');
        },
      },
      './workflow-stream': {
        closeStudioStreamStep: async (handle, error) => {
          assert.equal(handle, workflowHandle);
          await closeStudioStreamStep(writable, error);
        },
      },
    });
    const turn = subject.studioTurnWorkflow({
      runId: 'run',
      projectId: 'project',
      tenantId: 'tenant',
      sandboxName: 'sandbox',
      responseMessageUid: 'response',
      role: 'assistant',
      messages: [],
      operator: { id: 'user', name: 'Fixture', login: 'fixture' },
    });
    if (failure) await assert.rejects(turn, /Gate recusado/);
    else assert.equal((await turn).status, 'succeeded');
    assert.equal(closed, true);
    assert.equal(writable.locked, false);
    assert.equal(finished[0].status, failure ? 'failed' : 'succeeded');
    assert.equal(messages[0].id, 'response');
    assert.match(
      messages[0].parts.find((part) => part.type === 'text').text,
      failure ? /Gate recusado/ : /Turno concluído/,
    );
    assert.equal(
      output.some((part) => part.type === 'error'),
      failure,
    );
  });

void test('step libera o writer mesmo se a escrita de erro falhar', async () => {
  const writable = new WritableStream({
    write() {
      throw new Error('stream indisponível');
    },
  });
  await assert.rejects(
    closeStudioStreamStep(writable, 'falha'),
    /stream indisponível/,
  );
  assert.equal(writable.locked, false);
});

void test('UI recebe deltas imediatamente e finish só após persistência, inclusive ao retomar', async () => {
  const all = [];
  let finish;
  const completion = new Promise((resolve) => {
    finish = resolve;
  });
  const run = {
    getReadable: () => readable(modelParts()),
    get returnValue() {
      return completion;
    },
  };
  const consuming = (async () => {
    for await (const part of studioUIMessageStream(run)) all.push(part);
  })();
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(all.some((part) => part.type === 'text-delta'));
  assert.equal(
    all.some((part) => part.type === 'finish'),
    false,
  );
  finish({ status: 'succeeded' });
  await consuming;
  assert.equal(all.at(-1).type, 'finish');
  const resumed = [];
  for await (const part of studioUIMessageStream(run, 3)) resumed.push(part);
  assert.deepEqual(resumed, all.slice(3));
});

void test('falha de persistência chega à UI mesmo depois do stream do modelo fechar', async () => {
  const run = {
    getReadable: () => readable(modelParts()),
    get returnValue() {
      return Promise.reject(new Error('Falha ao persistir'));
    },
  };
  const chunks = [];
  for await (const part of studioUIMessageStream(run)) chunks.push(part);
  assert.match(
    chunks.find((part) => part.type === 'error').errorText,
    /Falha ao persistir/,
  );
});
