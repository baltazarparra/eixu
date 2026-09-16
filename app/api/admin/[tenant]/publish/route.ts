import { currentUser } from '@/lib/auth';
import { recordActivity } from '@/lib/admin/activity';
import { publishSite } from '@/lib/sites/publish';
import { getTenantBySlug } from '@/lib/tenant-queries';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const user = await currentUser();
  if (!user) return new Response('Não autorizado', { status: 401 });
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return new Response('Cliente não encontrado', { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { page?: string };
  const page = typeof body.page === 'string' ? body.page : undefined;
  const result = await publishSite(tenant, page);
  await recordActivity({
    actor: user,
    actorType: 'user',
    tenant,
    action: 'site.publish',
    result: result.blocked.length ? 'denied' : 'success',
    resourceType: page ? 'page' : 'site',
    resourceId: page,
    summary: result.blocked.length
      ? `${user.name} tentou publicar ${page || 'o site'}, mas o pre-flight recusou`
      : `${user.name} publicou ${page || 'o site'}`,
  });
  return Response.json(result);
}
