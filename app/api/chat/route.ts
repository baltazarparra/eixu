import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
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

  // Imagens anexadas chegam como partes de arquivo com URL pública do Blob. O
  // modelo vê a imagem, mas não lê a URL: anotamos a URL no texto para ele
  // usar exatamente essa string nas props dos blocos.
  const messages = body.messages.map((message) => {
    if (message.role !== 'user') return message;
    const files = message.parts.filter((part) => part.type === 'file') as { url: string; mediaType?: string }[];
    if (!files.length) return message;
    const note = files.map((file) => `[imagem anexada: ${file.url}]`).join('\n');
    const hasText = message.parts.some((part) => part.type === 'text');
    const parts = hasText
      ? message.parts.map((part) => (part.type === 'text' ? { ...part, text: `${(part as { text: string }).text}\n${note}` } : part))
      : [...message.parts, { type: 'text' as const, text: note }];
    return { ...message, parts };
  });

  // Guarda a mensagem do operador para o histórico do painel.
  const lastUser = [...messages].reverse().find((message) => message.role === 'user');
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
    instructions: systemPrompt(tenant, summary, body.page ? `/${body.page}` : '/'),
    messages: await convertToModelMessages(messages),
    tools: buildTools(tenant),
    stopWhen: isStepCount(30),
    onError: ({ error }) => {
      console.error('[chat] falha do modelo:', error);
    },
    onEnd: async ({ text }) => {
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
