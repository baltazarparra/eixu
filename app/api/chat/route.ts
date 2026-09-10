import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
import { annotateAttachments } from '@/lib/ai/attachments';
import { isAuthenticated } from '@/lib/auth';
import { buildTools } from '@/lib/ai/tools';
import { db } from '@/lib/db';
import { isDesignProfile } from '@/lib/design/profile';
import { listImages } from '@/lib/images/queries';
import { scenePlan, scenePlanText } from '@/lib/images/scene-plan';
import {
  PHASE_STEPS,
  PHASE_TOOLS,
  isPhase,
  type Phase,
} from '@/lib/taste/phases';
import { systemPrompt, type PromptContext } from '@/lib/taste/prompt';
import { getTenantBySlug, listPages } from '@/lib/tenant-queries';
import type { Page, Tenant } from '@/lib/types';

export const maxDuration = 300;

/** Modelo do agente. Com créditos no AI Gateway, Claude é o padrão. */
const MODEL = () => process.env.EIXU_MODEL || 'anthropic/claude-opus-4.5';

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

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return new Response('Não autorizado', { status: 401 });
  }

  const body = (await request.json()) as {
    messages: UIMessage[];
    tenant: string;
    page?: string;
    phase?: string;
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
    .filter((image) => image.kind === 'foto' && image.status !== 'rejeitada')
    .slice(0, 12)
    .map(
      (image) =>
        `- #${image.seq} ${image.status}, ${image.ratio}, ${image.targetBlock ?? 'livre'}: ${image.url} | ${image.alt ?? image.description ?? 'sem descrição'}`,
    )
    .join('\n');

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
    ...(phase === 'briefing' || !phase ? { sources } : {}),
    ...(phase === 'cenas'
      ? {
          scenePlan: scenePlanText(
            scenePlan(
              isDesignProfile(tenant.brand.design)
                ? tenant.brand.design
                : undefined,
              3,
            ),
          ),
        }
      : {}),
  };

  const messages = annotateAttachments(body.messages);

  // Guarda a mensagem do operador para o histórico do painel.
  // Persiste o texto que o operador escreveu, não a versão anotada com a URL
  // do anexo: a anotação é detalhe de implementação e polui o histórico.
  const lastUser = [...body.messages]
    .reverse()
    .find((message) => message.role === 'user');
  if (lastUser) {
    const text = lastUser.parts
      .filter((part) => part.type === 'text')
      .map((part) => (part as { text: string }).text)
      .join(' ');
    if (text) {
      await db()`
        insert into chat_messages (tenant_id, role, content, channel)
        values (${tenant.id}, 'user', ${text}, 'site')
      `;
    }
  }

  const tools = buildTools(tenant);
  // Fora da geração o chat mantém todas as ferramentas; dentro dela, só as da
  // etapa, para o modelo não pular direto para a composição.
  const activeTools = phase
    ? (PHASE_TOOLS[phase].filter(
        (name) => name in tools,
      ) as (keyof typeof tools)[])
    : undefined;

  if (phase) {
    const generation = {
      ...(tenant.brief.generation as Record<string, unknown>),
      phase,
      updatedAt: new Date().toISOString(),
    };
    await db()`
      update tenants
      set brief = ${JSON.stringify({ ...tenant.brief, generation })}::jsonb,
          updated_at = now()
      where id = ${tenant.id}
    `;
  }

  const result = streamText({
    model: MODEL(),
    instructions: systemPrompt(
      tenant,
      summary,
      body.page ? `/${body.page}` : '/',
      imagesSummary,
      context,
    ),
    messages: await convertToModelMessages(messages),
    tools,
    ...(activeTools ? { activeTools } : {}),
    stopWhen: isStepCount(phase ? PHASE_STEPS[phase] : 30),
    onError: ({ error }) => {
      console.error('[chat] falha do modelo:', error);
    },
    onEnd: async ({ text, usage, stepNumber }) => {
      // Apenas contagens: nenhum prompt, conteúdo do cliente ou credencial.
      console.info('[chat] usage', {
        model: MODEL(),
        phase: phase ?? 'livre',
        steps: stepNumber + 1,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
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
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
