import { start } from 'workflow/api';
import type { AdminUser } from '@/lib/auth';
import { recordActivity } from '@/lib/admin/activity';
import { studioPublishWorkflow } from './release-workflow';
import {
  attachReleaseWorkflow,
  createStudioRelease,
  currentStudioRelease,
  failStudioRelease,
  latestStudioRelease,
  type StudioRelease,
} from './releases';

export async function startStudioReleaseWorkflow(input: {
  release: StudioRelease;
  tenantId: string;
  projectId: string;
}): Promise<string> {
  if (input.release.workflowRunId) return input.release.workflowRunId;
  const workflow = await start(studioPublishWorkflow, [input.release.id], {
    attributes: {
      product: 'eixu',
      kind: 'studio-publish',
      tenant: input.tenantId,
      project: input.projectId,
      release: input.release.id,
    },
  }).catch(async (error) => {
    await failStudioRelease(
      input.release.id,
      'O workflow de publicação não pôde ser iniciado.',
    ).catch(() => undefined);
    throw error;
  });
  try {
    if (!(await attachReleaseWorkflow(input.release.id, workflow.runId)))
      throw new Error('O release não aceitou o vínculo do workflow.');
  } catch (error) {
    await workflow
      .cancel({
        cancelReason: 'O release não aceitou o vínculo do workflow.',
      })
      .catch(() => undefined);
    await failStudioRelease(
      input.release.id,
      error instanceof Error ? error.message : 'Falha ao vincular o workflow.',
    ).catch(() => undefined);
    throw error;
  }
  return workflow.runId;
}

/**
 * Única porta de entrada para uma publicação nova. Ela é idempotente para que
 * o passo durável da primeira criação possa ser repetido sem abrir dois
 * releases ou dois workflows.
 */
export async function startStudioPublication(input: {
  projectId: string;
  tenant: { id: string; slug: string; name: string };
  operator: AdminUser;
  automatic?: boolean;
}): Promise<{
  release: StudioRelease;
  workflowRunId: string;
  started: boolean;
}> {
  let release = await currentStudioRelease(input.projectId);
  let started = false;
  if (!release && input.automatic) {
    const latest = await latestStudioRelease(input.projectId);
    if (latest?.status === 'active') release = latest;
  }
  if (!release) {
    release = await createStudioRelease({
      projectId: input.projectId,
      requestedBy: input.operator.id,
    });
    started = true;
  }
  const workflowRunId =
    release.status === 'active'
      ? (release.workflowRunId ?? '')
      : await startStudioReleaseWorkflow({
          release,
          tenantId: input.tenant.id,
          projectId: input.projectId,
        });
  await recordActivity({
    actor: input.operator,
    tenant: input.tenant,
    action: input.automatic
      ? 'studio.release.auto_start'
      : 'studio.release.start',
    summary: input.automatic
      ? `${input.operator.name} iniciou a primeira publicação automática de ${input.tenant.name}`
      : `${input.operator.name} iniciou uma publicação`,
    resourceType: 'studio_release',
    resourceId: release.id,
    operationId: `studio-release:${release.id}`,
    detail: { workflowRunId, automatic: Boolean(input.automatic) },
  }).catch(() => undefined);
  return {
    release: { ...release, workflowRunId: workflowRunId || null },
    workflowRunId,
    started,
  };
}
