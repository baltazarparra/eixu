import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { recordActivity } from '@/lib/admin/activity';
import { getTenantBySlug } from '@/lib/tenant-queries';
import {
  saveStudioEditorContent,
  studioEditorStateByTenant,
} from '@/lib/studio/content';
import { StudioEditorError } from '@/lib/studio/editor';
import { sitesWriteGuard } from '@/lib/sites-maintenance';
import {
  parseBoundedPublicJson,
  PublicInputTooLargeError,
} from '@/lib/public-input.mjs';

const updateSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    contractHash: z.string().regex(/^[0-9a-f]{64}$/),
    values: z.record(z.string(), z.string()),
  })
  .strict();

async function context(params: Promise<{ tenant: string }>) {
  const operator = await currentUser();
  if (!operator)
    return { response: new Response('Não autorizado', { status: 401 }) };
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant)
    return {
      response: new Response('Cliente não encontrado', { status: 404 }),
    };
  return { operator, tenant };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const resolved = await context(params);
  if ('response' in resolved) return resolved.response;
  return Response.json({
    editor: await studioEditorStateByTenant(resolved.tenant.id),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const maintenance = await sitesWriteGuard();
  if (maintenance) return maintenance;
  const resolved = await context(params);
  if ('response' in resolved) return resolved.response;
  let body: unknown;
  try {
    body = await parseBoundedPublicJson(request, 512_000);
  } catch (error) {
    return Response.json(
      { error: 'Conteúdo inválido.' },
      { status: error instanceof PublicInputTooLargeError ? 413 : 400 },
    );
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: 'Conteúdo inválido.' }, { status: 400 });
  try {
    const editor = await saveStudioEditorContent({
      tenantId: resolved.tenant.id,
      userId: resolved.operator.id,
      ...parsed.data,
    });
    await recordActivity({
      actor: resolved.operator,
      tenant: resolved.tenant,
      action: 'studio.content.save',
      summary: `${resolved.operator.name} salvou o conteúdo do CMS`,
      resourceType: 'studio_content_revision',
      resourceId: String(editor.revision),
      operationId: `studio-content:${resolved.tenant.id}:${editor.revision}`,
    }).catch(() => undefined);
    return Response.json({ editor });
  } catch (error) {
    if (error instanceof StudioEditorError)
      return Response.json(
        {
          error: error.message,
          fields: error.fields,
          currentRevision: error.currentRevision,
        },
        { status: error.status },
      );
    throw error;
  }
}
