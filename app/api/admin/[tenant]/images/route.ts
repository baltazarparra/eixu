import { del } from '@vercel/blob';
import { z } from 'zod';
import { isAuthenticated } from '@/lib/auth';
import { deleteImage, getGuide, getImage, isReferenced, listImages, setStatus } from '@/lib/images/queries';
import { getTenantBySlug } from '@/lib/tenant-queries';

export const dynamic = 'force-dynamic';

async function resolve(params: Promise<{ tenant: string }>) {
  if (!(await isAuthenticated())) return { error: new Response('Não autorizado', { status: 401 }) };
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { error: new Response('Cliente não encontrado', { status: 404 }) };
  return { tenant };
}

/** Estado da biblioteca para a grade do painel. */
export async function GET(_request: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const resolved = await resolve(params);
  if (resolved.error) return resolved.error;
  const [images, guide] = await Promise.all([listImages(resolved.tenant.id), getGuide(resolved.tenant.id)]);
  return Response.json({ guide, images });
}

const patch = z.object({
  id: z.string(),
  status: z.enum(['aprovada', 'rejeitada', 'candidata']),
  alt: z.string().max(140).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const resolved = await resolve(params);
  if (resolved.error) return resolved.error;
  const parsed = patch.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const image = await setStatus(resolved.tenant.id, parsed.data.id, parsed.data.status, { alt: parsed.data.alt });
  if (!image) return Response.json({ error: 'Imagem não encontrada.' }, { status: 404 });
  return Response.json({ ok: true, image });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const resolved = await resolve(params);
  if (resolved.error) return resolved.error;
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id) return Response.json({ error: 'Informe o id.' }, { status: 400 });

  const image = await getImage(resolved.tenant.id, id);
  if (!image) return Response.json({ error: 'Imagem não encontrada.' }, { status: 404 });
  if (await isReferenced(resolved.tenant.id, image.url)) {
    return Response.json({ error: `A imagem #${image.seq} está em uso numa página.` }, { status: 409 });
  }

  await del(image.url).catch(() => undefined);
  await deleteImage(resolved.tenant.id, id);
  return Response.json({ ok: true });
}
