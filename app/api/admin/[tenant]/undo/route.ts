import { currentUser } from '@/lib/auth';
import { recordActivity } from '@/lib/admin/activity';
import { getPage, getTenantBySlug } from '@/lib/tenant-queries';
import { PageEditError } from '@/lib/ai/page-edits';
import { undoPageEdit } from '@/lib/sites/edits';

/** Desfazer do painel: restaura o rascunho da página, sem passar pelo modelo. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const user = await currentUser();
  if (!user) return new Response('Não autorizado', { status: 401 });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return new Response('Origem inválida', { status: 403 });
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return new Response('Cliente não encontrado', { status: 404 });
  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return Response.json({ error: 'Corpo inválido.' }, { status: 400 });
  }
  const wanted = (body as { page?: unknown } | null)?.page;
  if (typeof wanted !== 'string' || wanted.length > 200)
    return Response.json({ error: 'Página inválida.' }, { status: 400 });
  const page = await getPage(tenant.id, wanted.replace(/^\/+|\/+$/g, ''));
  if (!page) return new Response('Página não encontrada', { status: 404 });
  try {
    const undone = await undoPageEdit({ tenant, page, brand: tenant.brand });
    await recordActivity({
      actor: user,
      actorType: 'user',
      tenant,
      action: 'page.undo',
      resourceType: 'page',
      resourceId: page.id,
      summary: `${user.name} desfez a última edição de /${page.slug || ''}`,
    });
    return Response.json(undone);
  } catch (error) {
    if (error instanceof PageEditError)
      return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
