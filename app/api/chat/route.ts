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

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return new Response('Não autorizado', { status: 401 });
  }

  const { messages, tenant: slug } = (await request.json()) as {
    messages: UIMessage[];
    tenant: string;
  };

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return new Response('Cliente não encontrado', { status: 404 });

  const pages = await listPages(tenant.id);
  const summary = pages
    .map((page) => `- /${page.slug || ''} (${page.type}, ${page.blocks.length} blocos${page.publishedBlocks ? ', publicada' : ''})`)
    .join('\n');

  // Guarda a última mensagem do operador para o histórico do painel.
  const lastUser = [...messages].reverse().find((message) => message.role === 'user');
  if (lastUser) {
    const text = lastUser.parts
      .filter((part) => part.type === 'text')
      .map((part) => (part as { text: string }).text)
      .join(' ');
    if (text) {
      await db()`
        insert into chat_messages (tenant_id, role, content) values (${tenant.id}, 'user', ${text})
      `;
    }
  }

  const result = streamText({
    // Trocável por env. Com créditos no AI Gateway, use anthropic/claude-sonnet-4.5,
    // que decide layout e escreve copy muito melhor que os modelos do free tier.
    model: process.env.EIXU_MODEL || 'openai/gpt-oss-120b',
    instructions: systemPrompt(tenant, summary),
    messages: await convertToModelMessages(messages),
    tools: buildTools(tenant),
    stopWhen: isStepCount(24),
    onError: ({ error }) => {
      console.error('[chat] falha do modelo:', error);
    },
    onEnd: async ({ text }) => {
      if (text) {
        await db()`
          insert into chat_messages (tenant_id, role, content) values (${tenant.id}, 'assistant', ${text})
        `;
      }
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
