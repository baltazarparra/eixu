import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { getTenantBySlug } from '@/lib/tenant-queries';
import {
  PremiumEditorError,
  type PremiumEditorValues,
} from '@/lib/premium/editor';
import { publishPremiumContent } from '@/lib/premium/content';

const publishSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    schemaVersion: z.number().int().positive(),
    contractHash: z.string().regex(/^[0-9a-f]{64}$/),
    values: z.record(z.string().max(240), z.string().max(8_000)),
  })
  .strict();

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const user = await currentUser();
  if (!user) return new Response('Não autorizado', { status: 401 });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return new Response('Origem inválida', { status: 403 });
  const raw = await request.text();
  if (raw.length > 1_000_000)
    return Response.json({ error: 'Conteúdo muito grande.' }, { status: 413 });
  const input = publishSchema.safeParse(
    (() => {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
    })(),
  );
  if (!input.success)
    return Response.json(
      { error: 'Conteúdo editorial inválido.' },
      { status: 400 },
    );
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return new Response('Cliente não encontrado', { status: 404 });

  try {
    const content = await publishPremiumContent({
      actor: user,
      tenant,
      ...input.data,
      values: input.data.values as PremiumEditorValues,
    });
    return Response.json({ content });
  } catch (error) {
    if (error instanceof PremiumEditorError)
      return Response.json(
        {
          error: error.message,
          fields: error.fields,
          currentRevision: error.currentRevision,
        },
        { status: error.status },
      );
    console.error('[premium] falha ao publicar conteúdo', {
      tenantId: tenant.id,
      error: error instanceof Error ? error.name : 'unknown',
    });
    return Response.json(
      { error: 'Não foi possível publicar o conteúdo Premium.' },
      { status: 500 },
    );
  }
}
