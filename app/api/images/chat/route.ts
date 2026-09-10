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
import { buildImageTools } from '@/lib/ai/image-tools';
import { db } from '@/lib/db';
import { getGuide, listImages } from '@/lib/images/queries';
import { imageAgentPrompt } from '@/lib/images/prompt';
import { getTenantBySlug, listPages } from '@/lib/tenant-queries';

// Gerar 3 imagens e criticar as 3 leva mais que a duração padrão.
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return new Response('Não autorizado', { status: 401 });

  const body = (await request.json()) as { messages: UIMessage[]; tenant: string };
  const tenant = await getTenantBySlug(body.tenant);
  if (!tenant) return new Response('Cliente não encontrado', { status: 404 });

  const [guide, library, pages] = await Promise.all([
    getGuide(tenant.id),
    listImages(tenant.id),
    listPages(tenant.id),
  ]);
  const pagesSummary = pages.map((page) => `- /${page.slug} (${page.type}): ${page.title}`).join('\n');

  const messages = annotateAttachments(body.messages);
  // Persiste o texto que o operador escreveu, não a versão anotada com a URL
  // do anexo: a anotação é detalhe de implementação e polui o histórico.
  const lastUser = [...body.messages].reverse().find((message) => message.role === 'user');
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

  const result = streamText({
    model: process.env.EIXU_MODEL || 'anthropic/claude-opus-4.5',
    instructions: imageAgentPrompt(tenant, guide, library, pagesSummary),
    messages: await convertToModelMessages(messages),
    tools: buildImageTools(tenant, lastUserText),
    stopWhen: isStepCount(14),
    onError: ({ error }) => {
      console.error('[imagens] falha do modelo:', error);
    },
    onEnd: async ({ text }) => {
      if (text) {
        await db()`
          insert into chat_messages (tenant_id, role, content, channel)
          values (${tenant.id}, 'assistant', ${text}, 'imagens')
        `;
      }
    },
  });

  return createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) });
}
