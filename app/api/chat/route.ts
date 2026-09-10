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
import { systemPrompt } from '@/lib/taste/prompt';
import { getTenantBySlug, listPages } from '@/lib/tenant-queries';

export const maxDuration = 300;

/** Modelo do agente. Com créditos no AI Gateway, Claude é o padrão. */
const MODEL = () => process.env.EIXU_MODEL || 'anthropic/claude-opus-4.5';

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return new Response('Não autorizado', { status: 401 });
  }

  const body = (await request.json()) as {
    messages: UIMessage[];
    tenant: string;
    page?: string;
  };

  const tenant = await getTenantBySlug(body.tenant);
  if (!tenant) return new Response('Cliente não encontrado', { status: 404 });

  const pages = await listPages(tenant.id);
  const summary = pages
    .map(
      (page) =>
        `- /${page.slug} (${page.type}, ${page.blocks.length} blocos${page.publishedBlocks ? ', publicada' : ''}): ${page.title}`,
    )
    .join('\n');

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

  const result = streamText({
    model: MODEL(),
    instructions: systemPrompt(
      tenant,
      summary,
      body.page ? `/${body.page}` : '/',
    ),
    messages: await convertToModelMessages(messages),
    tools: buildTools(tenant),
    stopWhen: isStepCount(30),
    onError: ({ error }) => {
      console.error('[chat] falha do modelo:', error);
    },
    onEnd: async ({ text, usage, stepNumber }) => {
      // Apenas contagens: nenhum prompt, conteúdo do cliente ou credencial.
      console.info('[chat] usage', {
        model: MODEL(),
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
