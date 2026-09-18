import { currentUser } from '@/lib/auth';
import { getTenantBySlug } from '@/lib/tenant-queries';
import {
  StudioProjectBusyError,
  studioProjectByTenant,
  withIdleStudioProject,
} from '@/lib/studio/projects';
import { hasStudioDraftChanges } from '@/lib/studio/releases';
import { ensureStudioPreview } from '@/lib/studio/sandbox';
import { sitesWriteGuard } from '@/lib/sites-maintenance';

export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const user = await currentUser();
  if (!user) return new Response('Não autorizado', { status: 401 });
  const maintenance = await sitesWriteGuard();
  if (maintenance) return maintenance;
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return new Response('Cliente não encontrado', { status: 404 });
  const project = await studioProjectByTenant(tenant.id);
  if (!project)
    return Response.json(
      { error: 'Envie a primeira mensagem para criar o projeto.' },
      { status: 409 },
    );
  if (!project.draftCodeRevision || !project.activeContentRevisionId)
    return Response.json(
      { error: 'O projeto ainda não tem um checkpoint válido para prévia.' },
      { status: 409 },
    );
  try {
    const url = await withIdleStudioProject(project.id, () =>
      ensureStudioPreview({
        name: project.sandboxName,
        projectId: project.id,
        codeRevision: project.draftCodeRevision!,
        contentRevisionId: project.activeContentRevisionId!,
        userId: user.id,
      }),
    );
    return Response.json({
      url,
      codeRevision: project.draftCodeRevision,
      status: project.status,
      dirty: await hasStudioDraftChanges(project.id),
    });
  } catch (error) {
    if (error instanceof StudioProjectBusyError)
      return Response.json({ error: error.message }, { status: 409 });
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível iniciar a prévia.',
      },
      { status: 503 },
    );
  }
}
