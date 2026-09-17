const DEFAULT_REPOSITORY = 'baltazarparra/eixu';

export type PremiumDispatchResult = 'started' | 'scheduled';

/**
 * Dispara a conversão enquanto a requisição do operador ainda está ativa.
 * O cron continua como recuperação quando o token ou o GitHub não respondem.
 */
async function dispatchWorkflow(
  workflow: string,
  inputs: Record<string, string>,
): Promise<PremiumDispatchResult> {
  const token = process.env.GITHUB_WORKFLOW_TOKEN;
  if (!token) return 'scheduled';
  const repository =
    process.env.PREMIUM_GITHUB_REPOSITORY || DEFAULT_REPOSITORY;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    console.warn('[premium] repositório de dispatch inválido');
    return 'scheduled';
  }
  try {
    const response = await fetch(
      `https://api.github.com/repos/${repository}/actions/workflows/${workflow}/dispatches`,
      {
        method: 'POST',
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          'x-github-api-version': '2022-11-28',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs,
        }),
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (response.status === 204) return 'started';
    console.warn('[premium] dispatch imediato recusado', {
      status: response.status,
    });
  } catch (error) {
    console.warn('[premium] dispatch imediato indisponível', {
      error: error instanceof Error ? error.name : 'unknown',
    });
  }
  return 'scheduled';
}

export function dispatchPremiumConversion(
  conversionId: string,
): Promise<PremiumDispatchResult> {
  return dispatchWorkflow('premium-conversions.yml', {
    conversion_id: conversionId,
  });
}

export function dispatchPremiumRelease(
  projectKey: string,
): Promise<PremiumDispatchResult> {
  return dispatchWorkflow('premium-release.yml', { project_key: projectKey });
}
