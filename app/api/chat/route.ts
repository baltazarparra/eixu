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
import { anchorContext, resolveAnchor } from '@/lib/ai/anchor';
import { chatRequestSchema, contextMessages } from '@/lib/ai/context';
import { usageRecord, usageMetadata, sumGatewayCosts } from '@/lib/ai/usage';
import { completeChatStream, CHAT_INTERRUPTED } from '@/lib/ai/chat-stream';
import { createEditReceipt } from '@/lib/ai/edit-receipt';
import {
  isAffirmative,
  isProgressQuestion,
  isResumeRequest,
  isUndoRequest,
  savedProgressMessage,
} from '@/lib/ai/chat-progress';
import { workspaceState } from '@/lib/admin/state';
import { editPolicyFor, editScopeText } from '@/lib/ai/edit-policy';
import { interactionModeFor } from '@/lib/ai/interaction';
import {
  BLOCK_REMOVAL_CONFIRMATION,
  PageEditError,
  editingPageContext,
  literalEditClarification,
} from '@/lib/ai/page-edits';
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
import { availablePhotos } from '@/lib/taste/metrics';
import {
  evidenceContext,
  pendenciasContext,
  publicationPlan,
} from '@/lib/taste/pendencias';
import { systemPrompt, type PromptContext } from '@/lib/taste/prompt';
import { getTenantBySlug, listPages } from '@/lib/tenant-queries';
import { undoPageEdit } from '@/lib/sites/edits';
import { publicationMessage, publishSite } from '@/lib/sites/publish';
import {
  isDirectPublicationRequest,
  isPublicationRepairRequest,
} from '@/lib/sites/publication-request';

export const maxDuration = 800;

/** Stream de uma resposta pronta: mesma bolha do chat, sem chamar o modelo. */
function textResponse(text: string, changedDraft = false) {
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute({ writer }) {
        writer.write({ type: 'start' });
        writer.write({ type: 'text-start', id: 'aviso' });
        writer.write({ type: 'text-delta', id: 'aviso', delta: text });
        writer.write({ type: 'text-end', id: 'aviso' });
        // O rascunho mudou sem passar por ferramenta: a prévia precisa recarregar
        // pelo mesmo evento transitório que as edições do agente usam.
        if (changedDraft)
          writer.write({
            type: 'data-preview-update',
            transient: true,
            data: { toolCallId: 'servidor' },
          });
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
    availablePhotoCount: availablePhotos(libraryImages).length,
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
  // A ordem explícita é executada pelo servidor: o modelo não veta a decisão
  // editorial nem transforma autorização de publicação em confirmação de fatos.
  if (!phase && !hasFile && isDirectPublicationRequest(lastUserText)) {
    const text = publicationMessage(await publishSite(tenant));
    await persistAssistant(text);
    return textResponse(text);
  }
  const state = workspaceState(tenant, pages, libraryImages);
  const focusedPage = pages.find(
    (page) => page.slug === (body.page ?? '').replace(/^\/+|\/+$/g, ''),
  );
  const clarification =
    !phase && !hasFile
      ? literalEditClarification(lastUserText, focusedPage)
      : undefined;
  if (clarification) {
    await persistAssistant(clarification);
    return textResponse(clarification);
  }

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

  // Reverter é restaurar o estado anterior, não recriar conteúdo pelo modelo.
  // Sem isso, "não era pra remover" virava um bloco novo, com outro ID e outro
  // texto, anunciado como se fosse a seção de volta.
  if (!phase && isUndoRequest(lastUserText)) {
    const text = focusedPage
      ? await undoPageEdit({
          tenant,
          page: focusedPage,
          brand: tenant.brand,
        })
          .then(
            (undone) =>
              `Desfeito: o rascunho de ${undone.page} voltou ao estado anterior, com os mesmos blocos, textos e posições. Nada foi publicado. Confira a prévia.`,
          )
          .catch((error) =>
            error instanceof PageEditError
              ? error.message
              : 'Não consegui desfazer agora. Nada foi alterado.',
          )
      : 'Escolha primeiro a página no painel; o desfazer age sobre o rascunho da página em foco.';
    await persistAssistant(text);
    return textResponse(text, text.startsWith('Desfeito'));
  }

  // A revisão renderiza o rascunho pela própria origem da requisição.
  const origin = new URL(request.url).origin;
  // Uma recusa por tamanho de remoção termina com uma frase estável no recibo
  // do servidor. Só a resposta afirmativa a essa pergunta eleva o escopo, e
  // apenas no turno seguinte: um "sim" solto não autoriza nada.
  const previousAssistant = [...body.messages]
    .filter((message) => message.role === 'assistant')
    .at(-1);
  const previousAssistantText = (previousAssistant?.parts ?? [])
    .filter((part) => part.type === 'text')
    .map((part) => (part as { text: string }).text)
    .join(' ');
  const askedBlockRemoval = previousAssistantText.includes(
    BLOCK_REMOVAL_CONFIRMATION,
  );
  const confirmedBlockRemoval =
    askedBlockRemoval && isAffirmative(lastUserText);
  const conversationOnly =
    !phase &&
    !confirmedBlockRemoval &&
    interactionModeFor(lastUserText, previousAssistantText) === 'conversation';
  const editPolicy =
    phase || conversationOnly
      ? undefined
      : editPolicyFor(lastUserText, pages, body.page ?? '', {
          confirmedBlockRemoval,
        });
  const repairPublication = !phase && isPublicationRepairRequest(lastUserText);
  const anchor = resolveAnchor(focusedPage, body.anchor);
  context.editing = Boolean(editPolicy);
  context.conversationOnly = conversationOnly;
  context.editScope = editPolicy ? editScopeText(editPolicy) : undefined;
  context.anchor = editPolicy ? anchorContext(anchor) : undefined;
  if (editPolicy)
    context.editPage = editingPageContext(focusedPage, pages, editPolicy);
  // Tudo que o operador escreveu nesta conversa; confirm_evidence só aceita
  // fatos que ele mesmo digitou, não os que o modelo deduziu da página.
  const operatorText = body.messages
    .filter((message) => message.role === 'user')
    .flatMap((message) =>
      (message.parts ?? [])
        .filter((part) => part.type === 'text')
        .map((part) => (part as { text: string }).text),
    )
    .join('\n');
  // As pendências do painel entram no turno com a resolução decidida em código.
  // Antes, o agente só as via se o operador colasse a lista, e mesmo assim
  // precisava adivinhar qual frase faltava confirmar.
  if (editPolicy) {
    context.pendencias = pendenciasContext(
      publicationPlan({
        pages,
        images: libraryImages,
        brand: tenant.brand,
        brief: tenant.brief,
        operatorText,
      }),
      20,
      repairPublication,
    );
    context.evidencia = evidenceContext(tenant.brief);
  }
  const tools = buildTools(tenant, {
    origin,
    cookie: request.headers.get('cookie') ?? undefined,
    phase,
    lastUserText,
    operatorText,
    conversationOnly,
    editPolicy,
  });
  if (phase) await markPhase(tenant.id, phase);

  const modelRole = editPolicy ? 'edit' : 'agent';
  const model = productModel(modelRole);
  const started = Date.now();
  let completedSteps = 0;
  const editReceipt = editPolicy ? createEditReceipt() : undefined;
  const editOutcomes = new Map<string, { ok: boolean; changed: boolean }>();
  const agent = siteAgent({
    tenantId: tenant.id,
    tools,
    phase,
    modelRole,
    repairPublication,
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
              if (part.type === 'tool-result' || part.type === 'tool-error')
                editReceipt?.observe(
                  part.toolName,
                  part.input,
                  part.type === 'tool-result'
                    ? part.output
                    : { error: 'A tentativa foi recusada pelo servidor.' },
                );
              if (
                (part.type === 'tool-result' || part.type === 'tool-error') &&
                part.toolName === 'edit_page'
              ) {
                const output = (
                  part.type === 'tool-result' ? part.output : {}
                ) as {
                  ok?: boolean;
                  changed?: boolean;
                };
                const inputPage = (part.input as { page?: unknown } | undefined)
                  ?.page;
                const page =
                  typeof inputPage === 'string'
                    ? `/${inputPage.replace(/^\/+|\/+$/g, '')}`
                    : '(página não identificada)';
                editOutcomes.set(page, {
                  ok: output.ok === true,
                  changed:
                    output.changed === true ||
                    editOutcomes.get(page)?.changed === true,
                });
              }
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
        receipt: editReceipt ? () => editReceipt.text() : undefined,
        summary: async () => {
          if (editOutcomes.size) {
            const saved = [...editOutcomes]
              .filter(([, result]) => result.changed)
              .map(([page]) => page);
            const failed = [...editOutcomes.values()].some(
              (result) => !result.ok,
            );
            return [
              saved.length
                ? `Alterações salvas no rascunho de ${saved.join(', ')}. Confira a prévia.`
                : failed
                  ? 'Este pedido não teve alterações salvas.'
                  : 'A página já estava como solicitado.',
              failed
                ? 'Há alterações recusadas; confira o erro antes de tentar novamente.'
                : '',
              completedSteps >= 32
                ? 'Este turno atingiu o limite de passos.'
                : '',
            ]
              .filter(Boolean)
              .join(' ');
          }
          if (conversationOnly)
            return 'Não consegui concluir esta resposta. Tente enviar a pergunta novamente.';
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
