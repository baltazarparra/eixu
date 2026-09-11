import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
import { siteAgent } from '@/lib/ai/agent';
import { productModel } from '@/lib/ai/models';
import { annotateAttachments } from '@/lib/ai/attachments';
import { chatRequestSchema, contextMessages } from '@/lib/ai/context';
import { usageRecord, usageMetadata, sumGatewayCosts } from '@/lib/ai/usage';
import { isAuthenticated } from '@/lib/auth';
import { buildTools } from '@/lib/ai/tools';
import { db } from '@/lib/db';
import { isDesignProfile } from '@/lib/design/profile';
import { listImages } from '@/lib/images/queries';
import {
  sceneCoverage,
  scenePlanText,
  sceneText,
} from '@/lib/images/scene-plan';
import { plannedScenes } from '@/lib/sites/generation';
import { generatedPhotos } from '@/lib/taste/metrics';
import { isPhase, type Phase } from '@/lib/taste/phases';
import { systemPrompt, type PromptContext } from '@/lib/taste/prompt';
import { getTenantBySlug, listPages } from '@/lib/tenant-queries';
import type { Page, Tenant, TenantImage } from '@/lib/types';

export const maxDuration = 800;

/**
 * A fase só abre com o estado que ela pressupõe. Sem isso o agente tentava
 * compor páginas antes de existir direção, e revisar antes de existir página.
 */
function phaseBlocker(
  phase: Phase,
  tenant: Tenant,
  pages: Page[],
): string | null {
  const hasDesign = isDesignProfile(tenant.brand.design);
  if (phase !== 'briefing' && !hasDesign)
    return 'A direção de arte ainda não existe. Rode a fase de briefing antes.';
  if (phase === 'revisao' && !pages.length)
    return 'Não há páginas para revisar. Rode a fase de composição antes.';
  return null;
}

/** Plano, cobertura e a próxima vaga: o que a etapa de cenas precisa saber. */
function scenesContext(tenant: Tenant, images: TenantImage[]) {
  const plan = plannedScenes(tenant);
  const { covered, missing } = sceneCoverage(plan, generatedPhotos(images));
  return {
    scenePlan: scenePlanText(plan),
    coverage: `${covered.length} de ${plan.length} vagas já têm foto disponível.`,
    ...(missing[0] ? { nextScene: sceneText(missing[0]) } : {}),
  };
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

  const summary = pages
    .map(
      (page) =>
        `- /${page.slug} (${page.type}, ${page.blocks.length} blocos${page.publishedBlocks ? ', publicada' : ''}): ${page.title}`,
    )
    .join('\n');
  const imagesSummary = libraryImages
    .filter((image) => image.status !== 'rejeitada')
    .slice(0, 12)
    .map(
      (image) =>
        `- #${image.seq} (${image.kind}), ${image.ratio}, ${image.targetBlock ?? 'livre'}: ${image.url} | ${image.alt ?? image.description ?? image.requestText}`,
    );
  const imagesText = imagesSummary.join('\n');

  const sources = Array.isArray(tenant.brief.sources)
    ? (
        tenant.brief.sources as {
          url?: string;
          status?: string;
          motivo?: string;
          titulo?: string;
          texto?: string;
        }[]
      )
        .map((source) =>
          `- ${source.url} [${source.status}${source.motivo ? `: ${source.motivo}` : ''}] ${source.titulo ?? ''} ${source.texto ?? ''}`.trim(),
        )
        .join('\n')
    : '';

  const context: PromptContext = {
    phase,
    sources,
    review: JSON.stringify(
      (tenant.brief.generation as { review?: unknown } | undefined)?.review ??
        null,
    ),
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

  // A revisão renderiza o rascunho pela própria origem da requisição.
  const origin = new URL(request.url).origin;
  const tools = buildTools(tenant, {
    origin,
    cookie: request.headers.get('cookie') ?? undefined,
    phase,
    lastUserText,
  });
  if (phase) {
    const generation = {
      ...(tenant.brief.generation as Record<string, unknown>),
      phase,
      updatedAt: new Date().toISOString(),
    };
    await db()`
      update tenants
      set brief = brief || ${JSON.stringify({ generation })}::jsonb,
          updated_at = now()
      where id = ${tenant.id}
    `;
  }

  const model = productModel();
  const started = Date.now();
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
    onEnd: async ({ text, usage, steps, finishReason }) => {
      // Apenas contagens: nenhum prompt, conteúdo do cliente ou credencial.
      const measured = usageRecord(
        usage,
        model,
        phase ?? 'livre',
        steps.length,
        started,
      );
      console.info('[chat] usage', {
        ...measured,
        finishReason,
        costUsd: sumGatewayCosts(
          steps.map((step) => step.providerMetadata?.gateway?.cost),
        ),
      });
      if (text) {
        await db()`
          insert into chat_messages (tenant_id, role, content, channel)
          values (${tenant.id}, 'assistant', ${text}, 'site')
        `;
      }
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onError: (error) => {
        console.error(
          '[chat] falha do modelo:',
          error instanceof Error ? error.name : 'unknown',
        );
        return 'A geração não concluiu. O rascunho foi preservado; retome para conferir as pendências.';
      },
      messageMetadata: usageMetadata(model, phase ?? 'livre', started),
    }),
  });
}
