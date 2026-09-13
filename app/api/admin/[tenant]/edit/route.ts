import { isAuthenticated } from '@/lib/auth';
import { getPage, getTenantBySlug } from '@/lib/tenant-queries';
import { PageEditError } from '@/lib/ai/page-edits';
import { inlineEditSchema, applyInlineEdit } from '@/lib/sites/inline-edits';
import { savePageEdit } from '@/lib/sites/edits';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  if (!(await isAuthenticated()))
    return new Response('Não autorizado', { status: 401 });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return new Response('Origem inválida', { status: 403 });
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return new Response('Cliente não encontrado', { status: 404 });
  const raw = await request.text();
  if (raw.length > 256_000)
    return Response.json({ error: 'Edição muito grande.' }, { status: 400 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: 'Corpo inválido.' }, { status: 400 });
  }
  const input = inlineEditSchema.safeParse(body);
  if (!input.success)
    return Response.json(
      { error: 'Corpo de edição inválido.' },
      { status: 400 },
    );
  const page = await getPage(tenant.id, input.data.page);
  if (!page) return new Response('Página não encontrada', { status: 404 });
  try {
    const edited = applyInlineEdit(page, input.data, tenant.brand);
    const receipt = await savePageEdit({
      tenant,
      page,
      blocks: edited.blocks,
      brand: tenant.brand,
    });
    return Response.json({ ...receipt, changes: edited.changes });
  } catch (error) {
    if (error instanceof PageEditError)
      return Response.json(
        { error: error.message, fields: error.fields },
        { status: error.status },
      );
    throw error;
  }
}
