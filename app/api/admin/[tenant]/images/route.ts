import { logoStudioSummary } from '@/lib/images/logo-studio-state';
import { del } from '@vercel/blob';
import { z } from 'zod';
import { isAuthenticated } from '@/lib/auth';
import { UploadError } from '@/lib/blob/tenant-files';
import { TenantRemovedError } from '@/lib/tenant-lock';
import { uploadLibraryImage } from '@/lib/images/upload';
import { IMAGE_UPLOAD_MAX_BYTES } from '@/lib/images/upload-policy';
import {
  deleteImage,
  getGuide,
  getImage,
  listImages,
  referenceMessage,
  referenceReason,
  updateImageMetadata,
} from '@/lib/images/queries';
import { imageUsage } from '@/lib/images/usage';
import { getTenantBySlug, listPages } from '@/lib/tenant-queries';

export const dynamic = 'force-dynamic';

async function resolve(params: Promise<{ tenant: string }>) {
  if (!(await isAuthenticated()))
    return { error: new Response('Não autorizado', { status: 401 }) };
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant)
    return { error: new Response('Cliente não encontrado', { status: 404 }) };
  return { tenant };
}

const statuses = z.enum(['disponivel', 'aprovada', 'rejeitada', 'candidata']);

/** Um arquivo por pedido; o painel envia seleções múltiplas em sequência. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const resolved = await resolve(params);
  if (resolved.error) return resolved.error;
  if (
    Number(request.headers.get('content-length')) >
    IMAGE_UPLOAD_MAX_BYTES + 64 * 1024
  )
    return Response.json(
      { error: 'A imagem deve ter até 4 MB.' },
      { status: 413 },
    );
  const form = await request.formData().catch(() => null);
  const files = form?.getAll('file');
  if (files?.length !== 1 || !(files[0] instanceof File))
    return Response.json(
      { error: 'Envie uma imagem por vez.' },
      { status: 400 },
    );
  try {
    const image = await uploadLibraryImage(resolved.tenant.id, files[0]);
    return Response.json({ image }, { status: 201 });
  } catch (error) {
    if (error instanceof UploadError)
      return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof TenantRemovedError)
      return Response.json({ error: error.message }, { status: 404 });
    return Response.json(
      { error: 'Não foi possível salvar a imagem no acervo. Tente novamente.' },
      { status: 502 },
    );
  }
}

/** Estado da biblioteca para a grade do painel. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const resolved = await resolve(params);
  if (resolved.error) return resolved.error;
  const asked = new URL(request.url).searchParams.get('status');
  const status = statuses.safeParse(asked);
  if (asked && !status.success)
    return Response.json({ error: 'Estado inválido.' }, { status: 400 });
  const [images, guide, pages] = await Promise.all([
    listImages(resolved.tenant.id, status.success ? status.data : undefined),
    getGuide(resolved.tenant.id),
    listPages(resolved.tenant.id),
  ]);
  return Response.json({
    guide,
    images,
    logoUrl: resolved.tenant.brand.logoUrl ?? null,
    logoDarkUrl: resolved.tenant.brand.logoDarkUrl ?? null,
    logoStudioSummary: logoStudioSummary(
      resolved.tenant.brief,
      resolved.tenant.brand,
    ),
    usage: imageUsage(resolved.tenant, pages, images),
  });
}

const patch = z.strictObject({
  id: z.string(),
  alt: z.string().max(140),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const resolved = await resolve(params);
  if (resolved.error) return resolved.error;
  const parsed = patch.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success)
    return Response.json(
      { error: parsed.error.issues[0]?.message },
      { status: 400 },
    );

  const image = await updateImageMetadata(
    resolved.tenant.id,
    parsed.data.id,
    parsed.data.alt,
  );
  if (!image)
    return Response.json({ error: 'Imagem não encontrada.' }, { status: 404 });
  return Response.json({ ok: true, image });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const resolved = await resolve(params);
  if (resolved.error) return resolved.error;
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id) return Response.json({ error: 'Informe o id.' }, { status: 400 });

  const image = await getImage(resolved.tenant.id, id);
  if (!image)
    return Response.json({ error: 'Imagem não encontrada.' }, { status: 404 });
  const reason = await referenceReason(resolved.tenant.id, image.url);
  if (reason)
    return Response.json(
      { error: referenceMessage(image.seq, reason) },
      { status: 409 },
    );

  try {
    await del(image.url);
  } catch {
    return Response.json(
      {
        error:
          'O arquivo não pôde ser removido. A imagem continua na biblioteca; tente novamente.',
      },
      { status: 502 },
    );
  }
  await deleteImage(resolved.tenant.id, id);
  return Response.json({ ok: true });
}
