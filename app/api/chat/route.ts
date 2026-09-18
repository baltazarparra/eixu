import { randomUUID } from 'node:crypto';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  validateUIMessages,
} from 'ai';
import { start } from 'workflow/api';
import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { recordActivity } from '@/lib/admin/activity';
import { isTenantBlobUrl } from '@/lib/blob/tenant-url.mjs';
import { getTenantBySlug } from '@/lib/tenant-queries';
import { ensureStudioProject } from '@/lib/studio/projects';
import {
  activeStudioRun,
  attachWorkflowRun,
  createStudioRun,
  finishStudioRun,
} from '@/lib/studio/runs';
import {
  linkMessageToStudioRun,
  persistStudioMessage,
  studioMessages,
} from '@/lib/studio/messages';
import { studioConversationForModel } from '@/lib/studio/conversation';
import { routeStudioTurn } from '@/lib/studio/routing';
import { studioTools } from '@/lib/studio/tools';
import {
  studioTurnWorkflow,
  type StudioWorkflowInput,
} from '@/lib/studio/workflow';
import type { StudioMessage } from '@/lib/studio/types';
import { sitesWriteGuard } from '@/lib/sites-maintenance';
import { studioUIMessageStream } from '@/lib/studio/ui-stream';
import { shouldAutoPublishInitialProject } from '@/lib/studio/initial-publication';
import {
  parseBoundedPublicJson,
  PublicInputTooLargeError,
} from '@/lib/public-input.mjs';

export const maxDuration = 800;

const requestSchema = z
  .object({
    tenant: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    messages: z.array(z.unknown()).length(1),
    autoPublish: z.boolean().optional(),
  })
  .strict();

function messageText(message: StudioMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim();
}

function safeUserMessage(
  message: StudioMessage,
  tenantSlug: string,
): StudioMessage | null {
  if (message.role !== 'user' || !message.id || message.id.length > 180)
    return null;
  if (message.parts.length > 12) return null;
  let files = 0;
  let textBytes = 0;
  const parts: StudioMessage['parts'] = [];
  for (const part of message.parts) {
    if (part.type === 'text') {
      textBytes += Buffer.byteLength(part.text, 'utf8');
      if (textBytes > 50_000) return null;
      parts.push({ type: 'text', text: part.text });
      continue;
    }
    if (part.type !== 'file') return null;
    files += 1;
    if (
      files > 8 ||
      !part.mediaType.startsWith('image/') ||
      !isTenantBlobUrl(part.url, tenantSlug)
    )
      return null;
    parts.push({
      type: 'file',
      mediaType: part.mediaType.slice(0, 100),
      url: part.url,
      ...(part.filename ? { filename: part.filename.slice(0, 180) } : {}),
    });
  }
  const clean = { id: message.id, role: 'user' as const, parts };
  return messageText(clean) || files ? clean : null;
}

export async function POST(request: Request) {
  const operator = await currentUser();
  if (!operator) return new Response('Não autorizado', { status: 401 });
  const maintenance = await sitesWriteGuard();
  if (maintenance) return maintenance;
  let body: unknown;
  try {
    body = await parseBoundedPublicJson(request, 1_000_000);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof PublicInputTooLargeError
            ? 'Mensagem acima do limite.'
            : 'Mensagem ou cliente inválido.',
      },
      { status: error instanceof PublicInputTooLargeError ? 413 : 400 },
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success)
    return Response.json(
      { error: 'Mensagem ou cliente inválido.' },
      { status: 400 },
    );

  const tenant = await getTenantBySlug(parsed.data.tenant);
  if (!tenant) return new Response('Cliente não encontrado', { status: 404 });
  const project = await ensureStudioProject({
    tenantId: tenant.id,
    slug: tenant.slug,
  });
  if (project.status === 'archived')
    return Response.json(
      {
        error: 'O cliente está arquivado. Reative-o antes de editar o projeto.',
      },
      { status: 409 },
    );

  const candidate = parsed.data.messages[0];
  let validatedMessage: StudioMessage;
  try {
    [validatedMessage] = await validateUIMessages<StudioMessage>({
      messages: [candidate as StudioMessage],
    });
  } catch {
    return Response.json({ error: 'Mensagem inválida.' }, { status: 400 });
  }
  const userMessage = safeUserMessage(validatedMessage, tenant.slug);
  if (!userMessage)
    return Response.json(
      { error: 'Mensagem vazia ou inválida.' },
      { status: 400 },
    );

  const running = await activeStudioRun(project.id);
  if (running)
    return Response.json(
      {
        error:
          'Já existe um trabalho em andamento neste projeto. Acompanhe o turno atual ou cancele antes de enviar outro pedido.',
        runId: running.id,
        workflowRunId: running.workflowRunId,
      },
      { status: 409 },
    );

  const history = await studioMessages(tenant.id);
  const role = routeStudioTurn(project, messageText(userMessage));
  const autoPublish = shouldAutoPublishInitialProject({
    requested: parsed.data.autoPublish === true,
    role,
    draftCodeRevision: project.draftCodeRevision,
    historyLength: history.length,
  });
  const run = await createStudioRun({
    projectId: project.id,
    tenantId: tenant.id,
    requestMessageUid: userMessage.id,
    modelRole: role,
    kind:
      role === 'build' || role === 'edit' || role === 'refine' ? role : 'chat',
    requestedBy: operator.id,
    baseCodeRevision: project.draftCodeRevision,
  });
  if (!run)
    return Response.json(
      { error: 'Outro turno começou ao mesmo tempo. Recarregue o projeto.' },
      { status: 409 },
    );

  let workflowInput: StudioWorkflowInput;
  try {
    const inserted = await persistStudioMessage({
      tenantId: tenant.id,
      message: {
        ...userMessage,
        metadata: {
          runId: run.id,
          author: {
            type: 'user',
            name: operator.name,
            login: operator.login,
          },
        },
      },
      actor: { ...operator, type: 'user' },
      runId: run.id,
    });
    if (!inserted) {
      await finishStudioRun({
        runId: run.id,
        status: 'failed',
        error: 'O identificador da mensagem já foi usado.',
      });
      return Response.json(
        { error: 'Esta mensagem já foi processada. Recarregue a conversa.' },
        { status: 409 },
      );
    }
    await linkMessageToStudioRun({
      tenantId: tenant.id,
      messageUid: userMessage.id,
      runId: run.id,
    });

    const messages = await convertToModelMessages(
      studioConversationForModel([...history, userMessage]),
      { tools: studioTools, ignoreIncompleteToolCalls: true },
    );
    workflowInput = {
      runId: run.id,
      projectId: project.id,
      tenantId: tenant.id,
      tenant: { slug: tenant.slug, name: tenant.name },
      sandboxName: project.sandboxName,
      responseMessageUid: randomUUID(),
      role,
      messages,
      operator: {
        id: operator.id,
        name: operator.name,
        login: operator.login,
      },
      autoPublish,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Falha ao preparar o workflow.';
    await finishStudioRun({
      runId: run.id,
      status: 'failed',
      error: message,
    });
    return Response.json(
      { error: 'Não foi possível preparar o trabalho.' },
      { status: 503 },
    );
  }

  try {
    const workflowRun = await start(studioTurnWorkflow, [workflowInput], {
      attributes: {
        product: 'eixu',
        tenant: tenant.id,
        project: project.id,
        studioRun: run.id,
        role,
      },
    });
    try {
      const attached = await attachWorkflowRun(run.id, workflowRun.runId);
      if (!attached)
        throw new Error('O run do produto não aceitou o vínculo do workflow.');
      const response = createUIMessageStreamResponse({
        stream: studioUIMessageStream(workflowRun),
        headers: {
          'x-workflow-run-id': workflowRun.runId,
          'x-studio-run-id': run.id,
        },
      });
      await recordActivity({
        actor: operator,
        tenant,
        action: 'studio.turn.start',
        summary: `${operator.name} iniciou um turno do estúdio`,
        resourceType: 'studio_run',
        resourceId: run.id,
        operationId: `studio-run:${run.id}`,
        detail: { role, workflowRunId: workflowRun.runId },
      }).catch(() => undefined);
      return response;
    } catch (error) {
      await workflowRun
        .cancel({
          cancelReason: 'Falha ao vincular o workflow ao run do produto.',
        })
        .catch(() => undefined);
      throw error;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Falha ao iniciar o workflow.';
    await finishStudioRun({
      runId: run.id,
      status: 'failed',
      error: message,
    });
    return Response.json(
      { error: 'Não foi possível iniciar o trabalho.' },
      { status: 503 },
    );
  }
}
