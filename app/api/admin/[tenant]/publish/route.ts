import { isAuthenticated } from '@/lib/auth';
import { publishSite } from '@/lib/sites/publish';
import { getTenantBySlug } from '@/lib/tenant-queries';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  if (!(await isAuthenticated()))
    return new Response('Não autorizado', { status: 401 });
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return new Response('Cliente não encontrado', { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { page?: string };
  return Response.json(
    await publishSite(
      tenant,
      typeof body.page === 'string' ? body.page : undefined,
    ),
  );
}
