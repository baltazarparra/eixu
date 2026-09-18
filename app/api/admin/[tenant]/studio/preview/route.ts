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

export const maxDuration = 800;

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
  try {
    return await withIdleStudioProject(project.id, async (locked) => {
      if (
        locked.status === 'archived' ||
        !locked.draftCodeRevision ||
        !locked.activeContentRevisionId
      )
        return Response.json(
          {
            error:
              'O projeto precisa estar ativo e ter um checkpoint válido para prévia.',
          },
          { status: 409 },
        );
      const url = await ensureStudioPreview({
        name: locked.sandboxName,
        projectId: locked.id,
        codeRevision: locked.draftCodeRevision,
        contentRevisionId: locked.activeContentRevisionId,
        userId: user.id,
      });
      return Response.json({
        url,
        codeRevision: locked.draftCodeRevision,
        status: locked.status,
        dirty: await hasStudioDraftChanges(locked.id),
      });
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
