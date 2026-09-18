import { del } from '@vercel/blob';
import { publicBlobOptions } from '@/lib/blob/stores.mjs';
import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { recordActivity } from '@/lib/admin/activity';
import { UploadError } from '@/lib/blob/tenant-files';
import { TenantRemovedError } from '@/lib/tenant-lock';
import { uploadLibraryImage } from '@/lib/images/upload';
import { IMAGE_UPLOAD_MAX_BYTES } from '@/lib/images/upload-policy';
import {
  deleteImage,
  getImage,
  listImages,
  referenceMessage,
  referenceReason,
  updateImageMetadata,
} from '@/lib/images/queries';
import { getTenantBySlug } from '@/lib/tenant-queries';
import { sitesWriteGuard } from '@/lib/sites-maintenance';
import {
  parseBoundedPublicJson,
  parseBoundedPublicFormData,
  PublicInputTooLargeError,
} from '@/lib/public-input.mjs';

export const dynamic = 'force-dynamic';

async function resolve(params: Promise<{ tenant: string }>) {
  const user = await currentUser();
  if (!user) return { error: new Response('Não autorizado', { status: 401 }) };
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant)
    return { error: new Response('Cliente não encontrado', { status: 404 }) };
  return { tenant, user };
}

const statuses = z.enum(['disponivel', 'aprovada', 'rejeitada', 'candidata']);

/** Um arquivo por pedido; o painel envia seleções múltiplas em sequência. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const maintenance = await sitesWriteGuard();
  if (maintenance) return maintenance;
  const resolved = await resolve(params);
  if (resolved.error) return resolved.error;
  let form: FormData | null = null;
  try {
    form = await parseBoundedPublicFormData(
      request,
      IMAGE_UPLOAD_MAX_BYTES + 64 * 1024,
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof PublicInputTooLargeError
            ? 'A imagem deve ter até 4 MB.'
            : 'Upload inválido.',
      },
      { status: error instanceof PublicInputTooLargeError ? 413 : 400 },
    );
  }
  const files = form?.getAll('file');
  if (files?.length !== 1 || !(files[0] instanceof File))
    return Response.json(
      { error: 'Envie uma imagem por vez.' },
      { status: 400 },
    );
  try {
    const image = await uploadLibraryImage(resolved.tenant.id, files[0]);
    await recordActivity({
      actor: resolved.user,
      actorType: 'user',
      tenant: resolved.tenant,
      action: 'image.upload',
      resourceType: 'image',
      resourceId: image.id,
      summary: `${resolved.user.name} enviou a imagem ${image.seq} para o acervo`,
    });
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
  const images = await listImages(
    resolved.tenant.id,
    status.success ? status.data : undefined,
  );
  return Response.json({
    images,
    logoUrl: resolved.tenant.brand.logoUrl ?? null,
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
  const maintenance = await sitesWriteGuard();
  if (maintenance) return maintenance;
  const resolved = await resolve(params);
  if (resolved.error) return resolved.error;
  let body: unknown;
  try {
    body = await parseBoundedPublicJson(request, 16_000);
  } catch (error) {
    return Response.json(
      { error: 'Alteração inválida.' },
      { status: error instanceof PublicInputTooLargeError ? 413 : 400 },
    );
  }
  const parsed = patch.safeParse(body);
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
  await recordActivity({
    actor: resolved.user,
    actorType: 'user',
    tenant: resolved.tenant,
    action: 'image.update',
    resourceType: 'image',
    resourceId: image.id,
    summary: `${resolved.user.name} atualizou a descrição da imagem ${image.seq}`,
  });
  return Response.json({ ok: true, image });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const maintenance = await sitesWriteGuard();
  if (maintenance) return maintenance;
  const resolved = await resolve(params);
  if (resolved.error) return resolved.error;
  let body: { id?: unknown };
  try {
    body = (await parseBoundedPublicJson(request, 8_000)) as { id?: unknown };
  } catch (error) {
    return Response.json(
      { error: 'Pedido de exclusão inválido.' },
      { status: error instanceof PublicInputTooLargeError ? 413 : 400 },
    );
  }
  const id = typeof body.id === 'string' ? body.id : '';
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
    await del(image.url, publicBlobOptions());
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
  await recordActivity({
    actor: resolved.user,
    actorType: 'user',
    tenant: resolved.tenant,
    action: 'image.delete',
    resourceType: 'image',
    resourceId: image.id,
    summary: `${resolved.user.name} excluiu a imagem ${image.seq}`,
  });
  return Response.json({ ok: true });
}
