import { currentUser } from '@/lib/auth';
import { recordActivity } from '@/lib/admin/activity';
import { getTenantBySlug } from '@/lib/tenant-queries';
import { studioProjectByTenant } from '@/lib/studio/projects';
import {
  startStudioPublication,
  startStudioReleaseWorkflow,
} from '@/lib/studio/publish';
import {
  createStudioRollbackRelease,
  currentStudioRelease,
  hasStudioDraftChanges,
  latestStudioRelease,
  reconcileStudioRelease,
  rollbackCandidateStudioRelease,
  studioReleaseById,
} from '@/lib/studio/releases';
import { sitesWriteGuard } from '@/lib/sites-maintenance';
import {
  parseBoundedPublicJson,
  PublicInputTooLargeError,
} from '@/lib/public-input.mjs';

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
  const project = await studioProjectByTenant(tenant.id);
  if (!project)
    return {
      response: Response.json(
        { error: 'O projeto ainda não foi criado.' },
        { status: 409 },
      ),
    };
  return { operator, tenant, project };
}

function releaseResponse(
  release: Awaited<ReturnType<typeof studioReleaseById>>,
  dirty: boolean,
  rollbackCandidate: Awaited<
    ReturnType<typeof rollbackCandidateStudioRelease>
  > = null,
) {
  const rollback = rollbackCandidate
    ? {
        id: rollbackCandidate.id,
        activatedAt: rollbackCandidate.activatedAt,
      }
    : null;
  if (!release) return { release: null, dirty, rollbackCandidate: rollback };
  return {
    release: {
      id: release.id,
      status: release.status,
      url:
        release.status === 'active'
          ? `https://${release.canonicalHost}`
          : release.deploymentUrl,
      error: release.error,
      workflowRunId: release.workflowRunId,
    },
    dirty,
    rollbackCandidate: rollback,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const resolved = await context(params);
  if ('response' in resolved) return resolved.response;
  const requested = new URL(request.url).searchParams.get('release');
  let release = requested
    ? await studioReleaseById(requested)
    : await latestStudioRelease(resolved.project.id);
  if (release && release.projectId !== resolved.project.id)
    return Response.json(
      { error: 'Publicação não encontrada.' },
      { status: 404 },
    );
  if (
    release &&
    (release.status === 'ready' ||
      (release.status === 'failed' &&
        Boolean(
          release.manifest.promotionRequestedAt || release.manifest.promotedAt,
        )))
  ) {
    await reconcileStudioRelease(release.id);
    release = await studioReleaseById(release.id);
  }
  const rollbackCandidate = await rollbackCandidateStudioRelease(
    resolved.project.id,
  );
  return Response.json(
    releaseResponse(
      release,
      await hasStudioDraftChanges(resolved.project.id),
      rollbackCandidate,
    ),
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const maintenance = await sitesWriteGuard();
  if (maintenance) return maintenance;
  const resolved = await context(params);
  if ('response' in resolved) return resolved.response;
  let body: { rollbackReleaseId?: unknown };
  try {
    body = (await parseBoundedPublicJson(request, 8_000)) as {
      rollbackReleaseId?: unknown;
    };
  } catch (error) {
    return Response.json(
      { error: 'Pedido de publicação inválido.' },
      { status: error instanceof PublicInputTooLargeError ? 413 : 400 },
    );
  }
  const existing = await currentStudioRelease(resolved.project.id);
  if (existing)
    return Response.json(releaseResponse(existing, true), { status: 202 });
  try {
    const rollbackReleaseId =
      typeof body.rollbackReleaseId === 'string'
        ? body.rollbackReleaseId
        : null;
    if (!rollbackReleaseId) {
      const publication = await startStudioPublication({
        projectId: resolved.project.id,
        tenant: resolved.tenant,
        operator: resolved.operator,
      });
      return Response.json(releaseResponse(publication.release, true), {
        status: 202,
      });
    }
    const release = await createStudioRollbackRelease({
      projectId: resolved.project.id,
      sourceReleaseId: rollbackReleaseId,
      requestedBy: resolved.operator.id,
    });
    const workflowRunId = await startStudioReleaseWorkflow({
      release,
      tenantId: resolved.tenant.id,
      projectId: resolved.project.id,
    });
    await recordActivity({
      actor: resolved.operator,
      tenant: resolved.tenant,
      action: 'studio.release.rollback',
      summary: `${resolved.operator.name} iniciou o rollback de uma publicação`,
      resourceType: 'studio_release',
      resourceId: release.id,
      operationId: `studio-release:${release.id}`,
      detail: { workflowRunId, rollbackReleaseId },
    }).catch(() => undefined);
    return Response.json(releaseResponse({ ...release, workflowRunId }, true), {
      status: 202,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível iniciar a publicação.',
      },
      { status: 409 },
    );
  }
}
