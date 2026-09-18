import { randomBytes } from 'node:crypto';

const BYPASS_SECRET_BYTES = 16;
const BYPASS_SECRET_PATTERN = /^[a-f0-9]{32}$/;

type ProtectionBypass = {
  scope?: string;
};

export type VercelProjectProtection = {
  protectionBypass?: Record<string, ProtectionBypass>;
  ssoProtection?: { deploymentType?: string } | null;
};

export type VercelProtectionBypassUpdate =
  | { generate: { secret: string; note: string } }
  | { revoke: { secret: string; regenerate: false } };

/**
 * Produz um bypass efêmero aceito pela API da Vercel. O chamador deve revogá-lo
 * assim que terminar o smoke do deployment protegido.
 */
export function createStudioVercelBypassSecret(): string {
  return randomBytes(BYPASS_SECRET_BYTES).toString('hex');
}

export function hasStudioVercelBypass(
  project: VercelProjectProtection,
  secret: string,
): boolean {
  return project.protectionBypass?.[secret]?.scope === 'automation-bypass';
}

export function hasStudioPreviewProtection(
  project: VercelProjectProtection,
): boolean {
  return project.ssoProtection?.deploymentType === 'preview';
}

export function studioVercelBypassHeaders(secret: string): HeadersInit {
  if (!BYPASS_SECRET_PATTERN.test(secret))
    throw new Error('O bypass temporário da Vercel é inválido.');
  return {
    'x-vercel-protection-bypass': secret,
  };
}

/** A confirmação da API pode chegar antes de o bypass alcançar o edge. */
export async function fetchStudioPreviewWithBypass(
  url: string,
  headers: HeadersInit,
): Promise<Response> {
  const origin = new URL(url);
  const hasBypass = new Headers(headers).has('x-vercel-protection-bypass');
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(url, {
      redirect: 'manual',
      headers,
      signal: AbortSignal.timeout(30_000),
      cache: 'no-store',
    });
    const location = response.headers.get('location');
    const redirect = location ? new URL(location, url) : null;
    const awaitingBypass =
      hasBypass &&
      origin.protocol === 'https:' &&
      origin.hostname.endsWith('.vercel.app') &&
      [302, 307].includes(response.status) &&
      redirect?.origin === 'https://vercel.com' &&
      redirect.pathname === '/sso-api';
    if (!awaitingBypass || attempt >= 9) return response;
    await response.body?.cancel();
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
}

async function revokeTemporaryBypass(
  update: (
    body: VercelProtectionBypassUpdate,
  ) => Promise<VercelProjectProtection>,
  secret: string,
) {
  const project = await update({
    revoke: { secret, regenerate: false },
  });
  if (hasStudioVercelBypass(project, secret))
    throw new Error('A Vercel não revogou o bypass temporário do preview.');
}

/** Cria o bypass somente durante o smoke e tenta revogá-lo em toda saída. */
export async function withTemporaryStudioVercelBypass<T>(
  update: (
    body: VercelProtectionBypassUpdate,
  ) => Promise<VercelProjectProtection>,
  run: (headers: HeadersInit) => Promise<T>,
): Promise<T> {
  const secret = createStudioVercelBypassSecret();
  let project: VercelProjectProtection;
  try {
    project = await update({
      generate: {
        secret,
        note: 'EIXU Studio: smoke temporário de preview',
      },
    });
  } catch (error) {
    // A API pode ter criado o bypass antes de a resposta se perder.
    await revokeTemporaryBypass(update, secret).catch(() => undefined);
    throw error;
  }
  if (!hasStudioVercelBypass(project, secret)) {
    await revokeTemporaryBypass(update, secret).catch(() => undefined);
    throw new Error('A Vercel não confirmou o bypass temporário do preview.');
  }

  let result: T | undefined;
  let runFailed = false;
  let runError: unknown;
  try {
    result = await run(studioVercelBypassHeaders(secret));
  } catch (error) {
    runFailed = true;
    runError = error;
  }

  try {
    await revokeTemporaryBypass(update, secret);
  } catch (revokeError) {
    if (runFailed)
      throw new AggregateError(
        [runError, revokeError],
        'O smoke falhou e o bypass temporário também não foi revogado.',
      );
    throw revokeError;
  }
  if (runFailed) throw runError;
  return result as T;
}

export function studioSameOriginRedirect(
  currentUrl: string,
  location: string | null,
  expectedOrigin: string,
): string {
  if (!location) throw new Error('O smoke recebeu um redirect sem destino.');
  const next = new URL(location, currentUrl);
  if (next.origin !== expectedOrigin)
    throw new Error('O smoke recusou um redirect para outra origem.');
  return next.href;
}
