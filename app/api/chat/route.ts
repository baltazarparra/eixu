import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
import { siteAgent } from '@/lib/ai/agent';
import { productModel } from '@/lib/ai/models';
import { annotateAttachments } from '@/lib/ai/attachments';
import { chatRequestSchema, contextMessages } from '@/lib/ai/context';
import { usageRecord, usageMetadata, sumGatewayCosts } from '@/lib/ai/usage';
import { completeChatStream, CHAT_INTERRUPTED } from '@/lib/ai/chat-stream';
import {
  isProgressQuestion,
  isResumeRequest,
  savedProgressMessage,
} from '@/lib/ai/chat-progress';
import { workspaceState } from '@/lib/admin/state';
import { editPolicyFor, editScopeText } from '@/lib/ai/edit-policy';
import { isAuthenticated } from '@/lib/auth';
import { buildTools } from '@/lib/ai/tools';
import { db } from '@/lib/db';
import {
  imagesSummary,
  pagesSummary,
  phaseBlocker,
  reviewContext,
  scenesContext,
  sourcesText,
} from '@/lib/generation/context';
import { markPhase } from '@/lib/generation/runner';
import { activeRun, expireStaleRun } from '@/lib/generation/runs';
import { startGeneration } from '@/lib/generation/start';
import { listImages } from '@/lib/images/queries';
import { isPhase, PHASE_STEPS } from '@/lib/taste/phases';
import { systemPrompt, type PromptContext } from '@/lib/taste/prompt';
import { getTenantBySlug, listPages } from '@/lib/tenant-queries';

export const maxDuration = 800;

/** Stream de uma resposta pronta: mesma bolha do chat, sem chamar o modelo. */
function textResponse(text: string) {
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute({ writer }) {
        writer.write({ type: 'start' });
        writer.write({ type: 'text-start', id: 'aviso' });
        writer.write({ type: 'text-delta', id: 'aviso', delta: text });
        writer.write({ type: 'text-end', id: 'aviso' });
        writer.write({ type: 'finish', finishReason: 'stop' });
      },
    }),
  });
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return new Response('Não autorizado', { status: 401 });
  }

  const parsed = chatRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      { error: 'Mensagem inválida. Confira o cliente e tente novamente.' },
      { status: 400 },
    );
  const body = {
    ...parsed.data,
    messages: parsed.data.messages as UIMessage[],
  };

  const tenant = await getTenantBySlug(body.tenant);
  if (!tenant) return new Response('Cliente não encontrado', { status: 404 });

  const [pages, libraryImages] = await Promise.all([
    listPages(tenant.id),
    listImages(tenant.id),
  ]);
  const phase = isPhase(body.phase) ? body.phase : undefined;
  if (phase) {
    const blocker = phaseBlocker(phase, tenant, pages);
    if (blocker) return new Response(blocker, { status: 409 });
  }

  // Dois turnos no mesmo cliente disputavam as mesmas páginas e sobrescreviam
  // o recibo de revisão um do outro. Enquanto a geração roda, o chat espera.
  const running = await expireStaleRun(await activeRun(tenant.id));
  if (running && !phase)
    return Response.json(
      {
        error:
          'A geração deste cliente está em andamento. Acompanhe o andamento no painel e peça alterações quando ela terminar.',
      },
      { status: 409 },
    );

  const summary = pagesSummary(pages);
  const imagesText = imagesSummary(libraryImages);
  const sources = sourcesText(tenant);

  const context: PromptContext = {
    phase,
    sources,
    review: reviewContext(tenant),
    ...(phase === 'cenas' ? scenesContext(tenant, libraryImages) : {}),
  };

  const messages = annotateAttachments(contextMessages(body.messages));

  // Guarda a mensagem do operador para o histórico do painel.
  // Persiste o texto que o operador escreveu, não a versão anotada com a URL
  // do anexo: a anotação é detalhe de implementação e polui o histórico.
  const lastUser = [...body.messages]
    .reverse()
    .find((message) => message.role === 'user');
  const lastUserText = (lastUser?.parts ?? [])
    .filter((part) => part.type === 'text')
    .map((part) => (part as { text: string }).text)
    .join(' ');
  if (lastUserText) {
    await db()`
      insert into chat_messages (tenant_id, role, content, channel)
      values (${tenant.id}, 'user', ${lastUserText}, 'site')
    `;
  }

  const persistAssistant = async (text: string) => {
    await db()`
      insert into chat_messages (tenant_id, role, content, channel)
      values (${tenant.id}, 'assistant', ${text}, 'site')
    `;
  };

  const hasFile = Boolean(lastUser?.parts.some((part) => part.type === 'file'));
  const state = workspaceState(tenant, pages, libraryImages);

  if (!phase && isProgressQuestion(lastUserText) && !hasFile) {
    const text = savedProgressMessage(state);
    await persistAssistant(text);
    return textResponse(text);
  }

  // "Continuar" digitado retomava a geração como edição livre: 16 passos e
  // seis minutos no caminho errado. Agora abre a mesma execução do botão.
  if (!phase && isResumeRequest(lastUserText) && !hasFile) {
    if (state.generation.next === 'pronto') {
      const text = savedProgressMessage(state);
      await persistAssistant(text);
      return textResponse(text);
    }
    const started = await startGeneration({
      tenant,
      origin: new URL(request.url).origin,
    });
    const text = started.ok
      ? `Retomando a geração pela etapa "${started.phase}". Acompanhe o andamento no painel; pode fechar esta aba sem perder nada.`
      : started.error;
    await persistAssistant(text);
    return textResponse(text);
  }

  // A revisão renderiza o rascunho pela própria origem da requisição.
  const origin = new URL(request.url).origin;
  const editPolicy = phase ? undefined : editPolicyFor(lastUserText, pages);
  context.editing = Boolean(editPolicy);
  context.editScope = editPolicy ? editScopeText(editPolicy) : undefined;
  const tools = buildTools(tenant, {
    origin,
    cookie: request.headers.get('cookie') ?? undefined,
    phase,
    lastUserText,
    editPolicy,
  });
  if (phase) await markPhase(tenant.id, phase);

  const model = productModel();
  const started = Date.now();
  let completedSteps = 0;
  const agent = siteAgent({
    tenantId: tenant.id,
    tools,
    phase,
    instructions: systemPrompt(
      tenant,
      summary,
      body.page ? `/${body.page}` : '/',
      imagesText,
      context,
    ),
  });
  const result = await agent.stream({
    messages: await convertToModelMessages(messages),
    abortSignal: request.signal,
    onEnd: async ({ usage, steps, finishReason }) => {
      // Apenas contagens: nenhum prompt, conteúdo do cliente ou credencial.
      const measured = usageRecord(
        usage,
        model,
        phase ?? 'livre',
        steps.length,
        started,
      );
      console.info('[chat] usage', {
        tenantId: tenant.id,
        ...measured,
        finishReason,
        costUsd: sumGatewayCosts(
          steps.map((step) => step.providerMetadata?.gateway?.cost),
        ),
      });
    },
  });

  return createUIMessageStreamResponse({
    stream: completeChatStream(
      toUIMessageStream({
        tools,
        stream: result.stream.pipeThrough(
          new TransformStream({
            transform(part, controller) {
              if (part.type === 'finish-step') completedSteps += 1;
              if (
                part.type === 'error' ||
                part.type === 'tool-error' ||
                (part.type === 'tool-call' && part.invalid)
              ) {
                const event = {
                  tenantId: tenant.id,
                  phase: phase ?? 'livre',
                  event: part.type,
                  ...('toolName' in part ? { tool: part.toolName } : {}),
                  error:
                    'error' in part && part.error instanceof Error
                      ? part.error.name
                      : 'unknown',
                };
                if (part.type === 'error')
                  console.error('[chat] falha do turno', event);
                else
                  console.warn(
                    '[chat] tentativa de ferramenta recusada',
                    event,
                  );
              }
              controller.enqueue(part);
            },
          }),
        ),
        onError: () => CHAT_INTERRUPTED,
        messageMetadata: usageMetadata(model, phase ?? 'livre', started),
      }),
      {
        summary: async () => {
          const current = await getTenantBySlug(body.tenant);
          if (!current) return 'O cliente não está mais disponível no painel.';
          const [currentPages, currentImages] = await Promise.all([
            listPages(current.id),
            listImages(current.id),
          ]);
          const progress = savedProgressMessage(
            workspaceState(current, currentPages, currentImages),
          );
          return completedSteps >= (phase ? PHASE_STEPS[phase] : 32)
            ? `Este turno atingiu o limite de passos. ${progress}`
            : progress;
        },
        persist: persistAssistant,
      },
    ),
  });
}
