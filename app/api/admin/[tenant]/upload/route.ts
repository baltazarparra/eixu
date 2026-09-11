import { putTenantBlob } from '@/lib/blob/tenant-files';
import { isAuthenticated } from '@/lib/auth';
import { getTenantBySlug } from '@/lib/tenant-queries';

const ALLOWED = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);
const MAX_BYTES = 8 * 1024 * 1024;

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
  if (!ALLOWED.has(file.type))
    return Response.json(
      { error: `Tipo não aceito: ${file.type}` },
      { status: 415 },
    );
  if (file.size > MAX_BYTES)
    return Response.json({ error: 'Imagem acima de 8 MB.' }, { status: 413 });

  const kind = form.get('kind') === 'logo' ? 'logo' : 'media';
  const safeName =
    file.name
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'imagem';
  const blob = await putTenantBlob(
    tenant.id,
    `${kind}/${Date.now()}-${safeName}`,
    file,
    {
      access: 'public',
      addRandomSuffix: false,
      contentType: file.type,
    },
  );

  return Response.json({
    url: blob.url,
    name: file.name,
    type: file.type,
    size: file.size,
  });
}
