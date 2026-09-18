import { getWorkflowMetadata, sleep } from 'workflow';

async function activateReleaseWorkflowStep(
  releaseId: string,
  workflowRunId: string,
) {
  'use step';
  const { attachReleaseWorkflow } = await import('./releases');
  if (!(await attachReleaseWorkflow(releaseId, workflowRunId)))
    throw new Error('O release não aceitou o vínculo do workflow.');
}

async function provisionStep(releaseId: string) {
  'use step';
  const { provisionStudioDeployment } = await import('./releases');
  return provisionStudioDeployment(releaseId);
}

async function deploymentStatusStep(releaseId: string) {
  'use step';
  const { studioDeploymentStatus } = await import('./releases');
  return studioDeploymentStatus(releaseId);
}

async function verifyCandidateStep(releaseId: string) {
  'use step';
  const { verifyStudioDeployment } = await import('./releases');
  return verifyStudioDeployment(releaseId);
}

async function activateStep(releaseId: string) {
  'use step';
  const { activateStudioDeployment } = await import('./releases');
  return activateStudioDeployment(releaseId);
}

async function canonicalServedStep(releaseId: string) {
  'use step';
  const { studioCanonicalReleaseServed } = await import('./releases');
  return studioCanonicalReleaseServed(releaseId);
}

async function verifyCanonicalStep(releaseId: string) {
  'use step';
  const { verifyAndCommitStudioRelease } = await import('./releases');
  return verifyAndCommitStudioRelease(releaseId);
}

async function failStep(releaseId: string, message: string) {
  'use step';
  const { failStudioRelease } = await import('./releases');
  await failStudioRelease(releaseId, message);
}

async function reconcileStep(releaseId: string) {
  'use step';
  const { reconcileStudioRelease } = await import('./releases');
  return reconcileStudioRelease(releaseId);
}

/** Publicação sem modelo: checkpoint, build, smoke, promoção e recibo duráveis. */
export async function studioPublishWorkflow(releaseId: string) {
  'use workflow';
  const { workflowRunId } = getWorkflowMetadata();
  try {
    await activateReleaseWorkflowStep(releaseId, workflowRunId);
    await provisionStep(releaseId);
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const deployment = await deploymentStatusStep(releaseId);
      if (deployment.status === 'READY') {
        ready = true;
        break;
      }
      if (['ERROR', 'CANCELED'].includes(deployment.status))
        throw new Error(`O build terminou em ${deployment.status}.`);
      await sleep('5s');
    }
    if (!ready)
      throw new Error('O build não ficou pronto dentro de 10 minutos.');
    await verifyCandidateStep(releaseId);
    await activateStep(releaseId);
    // A borda leva alguns segundos para servir o deployment promovido. Sondar
    // antes de confirmar evita falhar uma publicação que só estava em trânsito.
    for (let attempt = 0; attempt < 24; attempt += 1) {
      if (await canonicalServedStep(releaseId)) break;
      await sleep('5s');
    }
    const result = await verifyCanonicalStep(releaseId);
    return { releaseId, status: 'active' as const, ...result };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Falha inesperada.';
    if (await reconcileStep(releaseId))
      return { releaseId, status: 'active' as const, reconciled: true };
    await failStep(releaseId, message);
    throw error;
  }
}
