import { isAuthenticated } from '@/lib/auth';
import { UploadError, storeTenantFile } from '@/lib/admin/upload';
import { getTenantBySlug } from '@/lib/tenant-queries';

/**
 * Sobe uma imagem para o Vercel Blob, público, no prefixo do cliente.
 * Usado pelo upload de logo e pelos anexos do chat.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  if (!(await isAuthenticated()))
    return new Response('Não autorizado', { status: 401 });
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return new Response('Cliente não encontrado', { status: 404 });

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File))
    return Response.json({ error: 'Envie um arquivo.' }, { status: 400 });

  const kind = form.get('kind') === 'logo' ? 'logo' : 'media';
  try {
    const url = await storeTenantFile(tenant.slug, kind, file);
    return Response.json({
      url,
      name: file.name,
      type: file.type,
      size: file.size,
    });
  } catch (error) {
    if (error instanceof UploadError)
      return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
