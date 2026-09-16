import { premiumProjectByToken } from '@/lib/premium/queries';

export type PremiumBridgeProject = NonNullable<
  Awaited<ReturnType<typeof premiumProjectByToken>>
>;

function normalizeHost(value: string): string {
  return value.trim().toLowerCase().split(':')[0];
}

/** O token nunca sai da rota server-side do projeto Premium. */
export async function premiumBridgeProject(
  request: Request,
): Promise<PremiumBridgeProject | null> {
  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : '';
  if (!token) return null;
  const project = await premiumProjectByToken(token);
  if (!project) return null;
  const publicHost = normalizeHost(
    request.headers.get('x-eixu-site-host') ?? '',
  );
  return publicHost === normalizeHost(project.canonicalHost) ? project : null;
}
