import {
  createModelCallToUIChunkTransform,
  type ModelCallStreamPart,
  WorkflowAgent,
} from '@ai-sdk/workflow';
import {
  isStepCount,
  readUIMessageStream,
  type LanguageModelUsage,
  type ModelMessage,
} from 'ai';
import { getWorkflowMetadata, getWritable } from 'workflow';
import { db } from '@/lib/db';
import {
  STUDIO_MODEL_POLICY_VERSION,
  studioModelPolicy,
  type StudioModelRole,
} from './models';
import { studioInstructions } from './prompt';
import { attachWorkflowRun, finishStudioRun } from './runs';
import { persistStudioMessage } from './messages';
import {
  studioTools,
  studioToolsContext,
  type StudioToolContext,
} from './tools';
import type { StudioMessage, StudioMessageMetadata } from './types';
import { checkpointStudioProject } from './checkpoint';
import { closeStudioStreamStep } from './workflow-stream';
import { downloadStudioAssetsStep } from './workflow-download';
import {
  beginStudioUsage,
  recordStudioUsage,
  type StudioStepUsageReceipt,
} from './usage';

export type StudioWorkflowInput = {
  runId: string;
  projectId: string;
  tenantId: string;
  tenant: { slug: string; name: string };
  sandboxName: string;
  responseMessageUid: string;
  role: StudioModelRole;
  messages: ModelMessage[];
  operator: { id: string; name: string; login: string };
  autoPublish: boolean;
};

function hasToolResult(steps: unknown[], toolName: string): boolean {
  return steps.some((step) =>
    ((step as { toolResults?: unknown[] }).toolResults ?? []).some(
      (result) => (result as { toolName?: string }).toolName === toolName,
    ),
  );
}

function hasArtifact(steps: unknown[], kind: string): boolean {
  return steps.some((step) =>
    ((step as { toolResults?: unknown[] }).toolResults ?? []).some((result) => {
      const item = result as { toolName?: string; input?: { kind?: string } };
      return item.toolName === 'record_artifact' && item.input?.kind === kind;
    }),
  );
}

function languageModelId(model: unknown, fallback: string): string {
  if (typeof model === 'string') return model;
  if (model && typeof model === 'object' && 'modelId' in model) {
    const modelId = (model as { modelId?: unknown }).modelId;
    if (typeof modelId === 'string' && modelId) return modelId;
  }
  return fallback;
}

export function createStudioAgent(
  role: StudioModelRole,
  context: StudioToolContext,
) {
  const selected = studioModelPolicy(role);
  return new WorkflowAgent({
    model: selected.model,
    reasoning: selected.reasoning,
    maxOutputTokens: selected.maxOutputTokens,
    maxRetries: 1,
    instructions: studioInstructions(role),
    tools: studioTools,
    toolsContext: studioToolsContext(context),
    experimental_download: downloadStudioAssetsStep,
    stopWhen: isStepCount(selected.maxSteps),
    providerOptions: {
      gateway: {
        caching: 'auto',
        tags: ['eixu', 'studio', role, STUDIO_MODEL_POLICY_VERSION],
      },
    },
    prepareStep: ({ steps }) => {
      if (role !== 'build') return {};
      const contextPolicy = studioModelPolicy('context');
      const contextModel = {
        model: contextPolicy.model,
        reasoning: contextPolicy.reasoning,
        maxOutputTokens: contextPolicy.maxOutputTokens,
      };
      const projectModel = {
        model: selected.model,
        reasoning: selected.reasoning,
        maxOutputTokens: selected.maxOutputTokens,
      };
      if (!hasToolResult(steps, 'read_project_context'))
        return {
          ...contextModel,
          activeTools: ['read_project_context'] as const,
          toolChoice: {
            type: 'tool' as const,
            toolName: 'read_project_context',
          },
        };
      if (!hasToolResult(steps, 'read_official_site'))
        return {
          ...contextModel,
          activeTools: ['read_official_site'] as const,
          toolChoice: { type: 'tool' as const, toolName: 'read_official_site' },
        };
      if (!hasArtifact(steps, 'context'))
        return {
          ...contextModel,
          activeTools: ['record_artifact'] as const,
          toolChoice: { type: 'tool' as const, toolName: 'record_artifact' },
        };
      if (!hasToolResult(steps, 'inspect_visual_reference'))
        return {
          ...projectModel,
          activeTools: ['inspect_visual_reference'] as const,
          toolChoice: {
            type: 'tool' as const,
            toolName: 'inspect_visual_reference',
          },
        };
      if (!hasArtifact(steps, 'art_direction'))
        return {
          ...projectModel,
          activeTools: ['record_artifact'] as const,
          toolChoice: { type: 'tool' as const, toolName: 'record_artifact' },
        };
      // WorkflowAgent retains previous prepareStep overrides. An empty object
      // would keep forcing record_artifact and never expose the file tools.
      return {
        ...projectModel,
        activeTools: Object.keys(studioTools) as (keyof typeof studioTools)[],
        toolChoice: 'auto' as const,
      };
    },
  });
}

function gatewayReceipt(steps: unknown[]) {
  let generationId: string | undefined;
  const costs: number[] = [];
  for (const step of steps) {
    const gateway = (
      step as { providerMetadata?: { gateway?: Record<string, unknown> } }
    ).providerMetadata?.gateway;
    if (!gateway) continue;
    if (typeof gateway.generationId === 'string')
      generationId = gateway.generationId;
    const cost = Number(gateway.cost);
    if (Number.isFinite(cost) && cost >= 0) costs.push(cost);
  }
  return {
    generationId,
    costUsd: costs.length
      ? costs.reduce((sum, cost) => sum + cost, 0)
      : undefined,
  };
}

function usageMetadata(input: {
  role: StudioModelRole;
  usage: LanguageModelUsage;
  steps: unknown[];
  finishReason: string;
  durationMs: number;
}): StudioMessageMetadata['usage'] {
  const policy = studioModelPolicy(input.role);
  const gateway = gatewayReceipt(input.steps);
  return {
    model: policy.model,
    modelRole: input.role,
    policyVersion: STUDIO_MODEL_POLICY_VERSION,
    reasoning: policy.reasoning,
    inputTokens: input.usage.inputTokens,
    outputTokens: input.usage.outputTokens,
    totalTokens: input.usage.totalTokens,
    reasoningTokens: input.usage.outputTokenDetails?.reasoningTokens,
    steps: input.steps.length,
    durationMs: input.durationMs,
    finishReason: input.finishReason,
    ...gateway,
  };
}

function stepUsageReceipts(
  role: StudioModelRole,
  steps: Array<{
    stepNumber: number;
    model: { modelId: string };
    usage: LanguageModelUsage;
    providerMetadata?: Record<string, Record<string, unknown>>;
  }>,
): StudioStepUsageReceipt[] {
  return steps.map((step) => {
    const gateway = step.providerMetadata?.gateway;
    const cost = Number(gateway?.cost);
    return {
      step: step.stepNumber,
      role,
      model: step.model.modelId,
      inputTokens: step.usage.inputTokens,
      outputTokens: step.usage.outputTokens,
      totalTokens: step.usage.totalTokens,
      reasoningTokens: step.usage.outputTokenDetails?.reasoningTokens,
      cacheReadTokens: step.usage.inputTokenDetails?.cacheReadTokens,
      cacheWriteTokens: step.usage.inputTokenDetails?.cacheWriteTokens,
      ...(Number.isFinite(cost) && cost >= 0 ? { costUsd: cost } : {}),
      ...(typeof gateway?.generationId === 'string'
        ? { generationId: gateway.generationId }
        : {}),
    };
  });
}

async function activateStudioWorkflowStep(
  runId: string,
  workflowRunId: string,
) {
  'use step';
  if (!(await attachWorkflowRun(runId, workflowRunId)))
    throw new Error('A execução durável não corresponde ao run do projeto.');
}

async function prepareStudioWorkspaceStep(sandboxName: string) {
  'use step';
  const { prepareStudioWorkspaceForRun } = await import('./sandbox');
  await prepareStudioWorkspaceForRun(sandboxName);
}

async function beginWorkflowStepUsageStep(input: {
  tenantId: string;
  runId: string;
  step: number;
  role: StudioModelRole;
  model: string;
}) {
  'use step';
  await beginStudioUsage(input);
}

async function recordWorkflowStepUsageStep(input: {
  tenantId: string;
  runId: string;
  receipt: StudioStepUsageReceipt;
}) {
  'use step';
  await recordStudioUsage({
    tenantId: input.tenantId,
    runId: input.runId,
    receipts: [input.receipt],
  });
}

async function persistWorkflowMessageStep(input: {
  workflowRunId: string;
  runId: string;
  tenantId: string;
  responseMessageUid: string;
  operator: StudioWorkflowInput['operator'];
  metadata: StudioMessageMetadata;
  usageReceipts: StudioStepUsageReceipt[];
}) {
  'use step';
  const { getRun } = await import('workflow/api');
  const run = getRun<ModelCallStreamPart>(input.workflowRunId);
  const uiStream = run
    .getReadable<ModelCallStreamPart>({ startIndex: 0 })
    .pipeThrough(createModelCallToUIChunkTransform());
  let message: StudioMessage | undefined;
  for await (const snapshot of readUIMessageStream<StudioMessage>({
    stream: uiStream,
    terminateOnError: true,
  }))
    message = snapshot;
  if (!message)
    message = {
      id: input.responseMessageUid,
      role: 'assistant',
      parts: [
        { type: 'text', text: 'O turno terminou sem uma resposta textual.' },
      ],
    };
  message = {
    ...message,
    id: input.responseMessageUid,
    role: 'assistant',
    metadata: input.metadata,
  };
  const persisted = await persistStudioMessage({
    tenantId: input.tenantId,
    message,
    actor: { ...input.operator, type: 'agent' },
    runId: input.runId,
  });
  if (!persisted) {
    const existing = (await db()`
      select 1 from chat_messages
      where tenant_id = ${input.tenantId}
        and channel = 'site'
        and message_uid = ${input.responseMessageUid}
        and studio_run_id = ${input.runId}
      limit 1
    `) as { '?column?': number }[];
    if (!existing.length)
      throw new Error(
        'O identificador da resposta já pertence a outra mensagem.',
      );
  }
  await recordStudioUsage({
    tenantId: input.tenantId,
    runId: input.runId,
    receipts: input.usageReceipts,
  });
  const finished = await finishStudioRun({
    runId: input.runId,
    status: 'succeeded',
    responseMessageUid: input.responseMessageUid,
    result: { finishReason: input.metadata.usage?.finishReason },
  });
  if (!finished) {
    const states = (await db()`
      select status, response_message_uid
      from studio_runs where id = ${input.runId} limit 1
    `) as { status: string; response_message_uid: string | null }[];
    const state = states[0];
    if (
      state?.status !== 'succeeded' ||
      state.response_message_uid !== input.responseMessageUid
    ) {
      await db()`
        delete from chat_messages
        where tenant_id = ${input.tenantId}
          and channel = 'site'
          and message_uid = ${input.responseMessageUid}
          and studio_run_id = ${input.runId}
      `;
      throw new Error('A execução deixou de estar ativa antes da conclusão.');
    }
  }
  await db()`
    update studio_projects set
      status = case when status = 'building' then 'ready' else status end,
      updated_at = now()
    where id = (
      select project_id from studio_runs
      where id = ${input.runId} and status = 'succeeded'
    )
  `;
}

async function failStudioWorkflowStep(input: {
  runId: string;
  tenantId: string;
  responseMessageUid: string;
  operator: StudioWorkflowInput['operator'];
  message: string;
}) {
  'use step';
  const rows = (await db()`
    select status from studio_runs where id = ${input.runId} limit 1
  `) as { status: string }[];
  if (
    rows[0]?.status === 'cancel_requested' ||
    rows[0]?.status === 'cancelled'
  ) {
    await finishStudioRun({
      runId: input.runId,
      status: 'cancelled',
      error: 'Cancelado pelo operador.',
    });
    return;
  }
  await persistStudioMessage({
    tenantId: input.tenantId,
    message: {
      id: input.responseMessageUid,
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: `Não consegui concluir este turno. ${input.message}`.slice(
            0,
            2_400,
          ),
        },
      ],
      metadata: {
        runId: input.runId,
        author: {
          type: 'agent',
          name: input.operator.name,
          login: input.operator.login,
        },
      },
    },
    actor: { ...input.operator, type: 'agent' },
    runId: input.runId,
  });
  await finishStudioRun({
    runId: input.runId,
    status: rows[0]?.status === 'cancel_requested' ? 'cancelled' : 'failed',
    error: input.message.slice(0, 2_000),
  });
}

async function autoPublishInitialProjectStep(input: {
  runId: string;
  projectId: string;
  tenantId: string;
  tenant: StudioWorkflowInput['tenant'];
  operator: StudioWorkflowInput['operator'];
}) {
  'use step';
  try {
    const { startStudioPublication } = await import('./publish');
    const publication = await startStudioPublication({
      projectId: input.projectId,
      tenant: { id: input.tenantId, ...input.tenant },
      operator: input.operator,
      automatic: true,
    });
    await db()`
      update studio_runs set
        result = result || ${JSON.stringify({
          automaticPublication: {
            releaseId: publication.release.id,
            workflowRunId: publication.workflowRunId,
            status: publication.release.status,
          },
        })}::jsonb,
        updated_at = now()
      where id = ${input.runId}
    `;
    return {
      ok: true as const,
      releaseId: publication.release.id,
      workflowRunId: publication.workflowRunId,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'A primeira publicação não pôde ser iniciada.';
    await db()`
      update studio_runs set
        result = result || ${JSON.stringify({
          automaticPublication: { status: 'failed', error: message },
        })}::jsonb,
        updated_at = now()
      where id = ${input.runId}
    `;
    return { ok: false as const, error: message };
  }
}

export async function studioTurnWorkflow(input: StudioWorkflowInput) {
  'use workflow';
  const started = Date.now();
  const { workflowRunId } = getWorkflowMetadata();
  const context: StudioToolContext = {
    runId: input.runId,
    projectId: input.projectId,
    tenantId: input.tenantId,
    sandboxName: input.sandboxName,
    workflowRunId,
  };
  const writable = getWritable<ModelCallStreamPart>();
  try {
    await activateStudioWorkflowStep(input.runId, workflowRunId);
    await prepareStudioWorkspaceStep(input.sandboxName);
    const policy = studioModelPolicy(input.role);
    const result = await createStudioAgent(input.role, context).stream({
      messages: input.messages,
      writable,
      preventClose: true,
      sendFinish: false,
      toolsContext: studioToolsContext(context),
      providerOptions: {
        gateway: {
          caching: 'auto',
          user: input.tenantId,
          tags: ['eixu', 'studio', input.role, STUDIO_MODEL_POLICY_VERSION],
        },
      },
      maxOutputTokens: policy.maxOutputTokens,
      reasoning: policy.reasoning,
      onStepStart: async (step) => {
        await beginWorkflowStepUsageStep({
          tenantId: input.tenantId,
          runId: input.runId,
          step: step.stepNumber,
          role: input.role,
          model: languageModelId(step.model, policy.model),
        });
      },
      onStepEnd: async (step) => {
        const [receipt] = stepUsageReceipts(input.role, [step]);
        await recordWorkflowStepUsageStep({
          tenantId: input.tenantId,
          runId: input.runId,
          receipt,
        });
      },
    });
    await checkpointStudioProject({
      runId: input.runId,
      projectId: input.projectId,
      sandboxName: input.sandboxName,
      userId: input.operator.id,
      workflowRunId,
    });
    await closeStudioStreamStep(writable);
    await persistWorkflowMessageStep({
      workflowRunId,
      runId: input.runId,
      tenantId: input.tenantId,
      responseMessageUid: input.responseMessageUid,
      operator: input.operator,
      metadata: {
        runId: input.runId,
        author: {
          type: 'agent',
          name: input.operator.name,
          login: input.operator.login,
        },
        usage: usageMetadata({
          role: input.role,
          usage: result.totalUsage,
          steps: result.steps,
          finishReason: result.finishReason,
          durationMs: Date.now() - started,
        }),
      },
      usageReceipts: stepUsageReceipts(input.role, result.steps),
    });
    const automaticPublication = input.autoPublish
      ? await autoPublishInitialProjectStep({
          runId: input.runId,
          projectId: input.projectId,
          tenantId: input.tenantId,
          tenant: input.tenant,
          operator: input.operator,
        })
      : null;
    return {
      runId: input.runId,
      status: 'succeeded' as const,
      automaticPublication,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Falha inesperada.';
    await failStudioWorkflowStep({
      runId: input.runId,
      tenantId: input.tenantId,
      responseMessageUid: input.responseMessageUid,
      operator: input.operator,
      message,
    });
    try {
      await closeStudioStreamStep(writable, message);
    } catch {
      // O agente pode ter fechado o stream ao falhar; o estado persistido
      // continua sendo a fonte de verdade do painel.
    }
    throw error;
  }
}
