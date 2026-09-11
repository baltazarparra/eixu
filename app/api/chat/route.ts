import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
import { annotateAttachments } from '@/lib/ai/attachments';
import { chatRequestSchema, economicalMessages } from '@/lib/ai/context';
import {
  gatewayOptions,
  usageRecord,
  usageMetadata,
  sumGatewayCosts,
} from '@/lib/ai/usage';
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

  const messages = annotateAttachments(economicalMessages(body.messages));

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

  // A revisão renderiza o rascunho pela própria origem da requisição.
  const origin = new URL(request.url).origin;
  const tools = buildTools(tenant, {
    origin,
    cookie: request.headers.get('cookie') ?? undefined,
  });
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
      set brief = brief || ${JSON.stringify({ generation })}::jsonb,
          updated_at = now()
      where id = ${tenant.id}
    `;
  }

  const model = MODEL();
  const started = Date.now();
  const result = streamText({
    model,
    providerOptions: gatewayOptions(tenant.id, 'site', phase),
    abortSignal: request.signal,
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
      console.error(
        '[chat] falha do modelo:',
        error instanceof Error ? error.name : 'unknown',
      );
    },
    onEnd: async ({ text, usage, stepNumber, steps }) => {
      // Apenas contagens: nenhum prompt, conteúdo do cliente ou credencial.
      const measured = usageRecord(
        usage,
        model,
        phase ?? 'livre',
        stepNumber + 1,
        started,
      );
      console.info('[chat] usage', {
        ...measured,
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
      messageMetadata: usageMetadata(model, phase ?? 'livre', started),
    }),
  });
}
