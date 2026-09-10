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
import { buildImageTools } from '@/lib/ai/image-tools';
import { db } from '@/lib/db';
import { getGuide, listImages } from '@/lib/images/queries';
import { imageAgentPrompt } from '@/lib/images/prompt';
import { getTenantBySlug, listPages } from '@/lib/tenant-queries';

// Gerar 3 imagens e criticar as 3 leva mais que a duração padrão.
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!(await isAuthenticated()))
    return new Response('Não autorizado', { status: 401 });

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

  const [guide, library, pages] = await Promise.all([
    getGuide(tenant.id),
    listImages(tenant.id),
    listPages(tenant.id),
  ]);
  const pagesSummary = pages
    .map((page) => `- /${page.slug} (${page.type}): ${page.title}`)
    .join('\n');

  const messages = annotateAttachments(economicalMessages(body.messages));
  // Persiste o texto que o operador escreveu, não a versão anotada com a URL
  // do anexo: a anotação é detalhe de implementação e polui o histórico.
  const lastUser = [...body.messages]
    .reverse()
    .find((message) => message.role === 'user');
  const lastUserText = lastUser
    ? lastUser.parts
        .filter((part) => part.type === 'text')
        .map((part) => (part as { text: string }).text)
        .join(' ')
    : '';
  if (lastUser) {
    const text = lastUserText;
    if (text) {
      await db()`
        insert into chat_messages (tenant_id, role, content, channel)
        values (${tenant.id}, 'user', ${text}, 'imagens')
      `;
    }
  }

  const model = process.env.EIXU_MODEL || 'anthropic/claude-opus-4.5';
  const started = Date.now();
  const result = streamText({
    model,
    providerOptions: gatewayOptions(tenant.id, 'imagens'),
    abortSignal: request.signal,
    instructions: imageAgentPrompt(tenant, guide, library, pagesSummary),
    messages: await convertToModelMessages(messages),
    tools: buildImageTools(tenant, lastUserText),
    stopWhen: isStepCount(14),
    onError: ({ error }) => {
      console.error(
        '[imagens] falha do modelo:',
        error instanceof Error ? error.name : 'unknown',
      );
    },
    onEnd: async ({ text, usage, stepNumber, steps }) => {
      const measured = usageRecord(
        usage,
        model,
        'imagens',
        stepNumber + 1,
        started,
      );
      console.info('[imagens] usage', {
        ...measured,
        costUsd: sumGatewayCosts(
          steps.map((step) => step.providerMetadata?.gateway?.cost),
        ),
      });
      if (text) {
        await db()`
          insert into chat_messages (tenant_id, role, content, channel)
          values (${tenant.id}, 'assistant', ${text}, 'imagens')
        `;
      }
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      messageMetadata: usageMetadata(model, 'imagens', started),
    }),
  });
}
