import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { getTenantBySlug } from '@/lib/tenant-queries';
import {
  createPremiumPreviewSession,
  updatePremiumPreviewSession,
} from '@/lib/premium/content';
import { PremiumEditorError } from '@/lib/premium/editor';

const updateSchema = z
  .object({
    token: z.string().min(32).max(200),
    contractHash: z.string().regex(/^[0-9a-f]{64}$/),
    version: z.number().int().positive(),
    values: z.record(z.string().max(240), z.string().max(8_000)),
  })
  .strict();

async function context(request: Request, params: Promise<{ tenant: string }>) {
  const user = await currentUser();
  if (!user)
    return { response: new Response('Não autorizado', { status: 401 }) };
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return { response: new Response('Origem inválida', { status: 403 }) };
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant)
    return {
      response: new Response('Cliente não encontrado', { status: 404 }),
    };
  return { user, tenant };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const resolved = await context(request, params);
  if ('response' in resolved) return resolved.response;
  try {
    const preview = await createPremiumPreviewSession({
      tenantId: resolved.tenant.id,
      userId: resolved.user.id,
    });
    return Response.json(preview, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof PremiumEditorError)
      return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const resolved = await context(request, params);
  if ('response' in resolved) return resolved.response;
  const raw = await request.text();
  if (raw.length > 1_000_000)
    return Response.json({ error: 'Conteúdo muito grande.' }, { status: 413 });
  const input = updateSchema.safeParse(
    (() => {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
    })(),
  );
  if (!input.success)
    return Response.json({ error: 'Rascunho inválido.' }, { status: 400 });
  try {
    return Response.json(
      await updatePremiumPreviewSession({
        tenantId: resolved.tenant.id,
        ...input.data,
      }),
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    if (error instanceof PremiumEditorError)
      return Response.json(
        { error: error.message, fields: error.fields },
        { status: error.status },
      );
    throw error;
  }
}
