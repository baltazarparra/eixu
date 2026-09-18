import { createHmac } from 'node:crypto';

const BYPASS_CONTEXT = 'eixu-studio-vercel-bypass:v1';
const MINIMUM_MASTER_SECRET_BYTES = 32;

type ProtectionBypass = {
  scope?: string;
};

export type VercelProjectProtection = {
  protectionBypass?: Record<string, ProtectionBypass>;
  ssoProtection?: { deploymentType?: string } | null;
};

function masterSecret(value = process.env.EIXU_VERCEL_BYPASS_MASTER_SECRET) {
  if (!value)
    throw new Error(
      'A publicação requer EIXU_VERCEL_BYPASS_MASTER_SECRET no ambiente da plataforma.',
    );
  if (Buffer.byteLength(value, 'utf8') < MINIMUM_MASTER_SECRET_BYTES)
    throw new Error(
      `EIXU_VERCEL_BYPASS_MASTER_SECRET precisa ter ao menos ${MINIMUM_MASTER_SECRET_BYTES} bytes.`,
    );
  return value;
}

/**
 * Produz um bypass estável e isolado por projeto sem persistir seu valor no banco.
 * O prefixo versionado permite uma rotação futura com migração explícita.
 */
export function studioVercelBypassSecret(
  projectId: string,
  secret?: string,
): string {
  if (!projectId.trim()) throw new Error('O projeto Vercel é obrigatório.');
  const key = masterSecret(secret);
  return createHmac('sha256', key)
    .update(`${BYPASS_CONTEXT}:${projectId}`)
    .digest('hex');
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

export function studioVercelBypassHeaders(
  projectId: string,
  secret?: string,
): HeadersInit {
  return {
    'x-vercel-protection-bypass': studioVercelBypassSecret(projectId, secret),
  };
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
