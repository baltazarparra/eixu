import { workspaceState } from '@/lib/admin/state';
import { isAuthenticated } from '@/lib/auth';
import { lastMessageId, messagesAfter } from '@/lib/ai/history';
import {
  activeRun,
  expireStaleRun,
  latestRun,
  listEvents,
} from '@/lib/generation/runs';
import { startGeneration } from '@/lib/generation/start';
import { listImages } from '@/lib/images/queries';
import { getTenantBySlug, listPages } from '@/lib/tenant-queries';

/**
 * Andamento da geração pelo estado gravado. O painel lê daqui em vez de
 * depender do stream: recarregar, trocar de aba ou abrir em outro aparelho
 * mostra a mesma execução, com a etapa e a atividade atuais.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  if (!(await isAuthenticated()))
    return new Response('Não autorizado', { status: 401 });
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return new Response('Cliente não encontrado', { status: 404 });

  const after = Number(new URL(request.url).searchParams.get('after') ?? 0);
  const [pages, images] = await Promise.all([
    listPages(tenant.id),
    listImages(tenant.id),
  ]);
  const run = await expireStaleRun(
    (await activeRun(tenant.id)) ?? (await latestRun(tenant.id)),
  );
  const [events, messages, lastId] = await Promise.all([
    run ? listEvents(run.id) : Promise.resolve([]),
    Number.isFinite(after) && after > 0
      ? messagesAfter(tenant.id, after)
      : Promise.resolve([]),
    lastMessageId(tenant.id),
  ]);

  return Response.json({
    run,
    events,
    messages,
    lastMessageId: lastId,
    state: workspaceState(tenant, pages, images),
  });
}

/** Inicia ou retoma a geração. Um run por cliente, garantido pelo índice. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  if (!(await isAuthenticated()))
    return new Response('Não autorizado', { status: 401 });
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return new Response('Cliente não encontrado', { status: 404 });

  const result = await startGeneration({
    tenant,
    origin: new URL(request.url).origin,
  });
  if (!result.ok)
    return Response.json(
      { error: result.error, ...(result.run ? { run: result.run } : {}) },
      { status: result.status },
    );
  return Response.json({ run: result.run }, { status: 202 });
}
