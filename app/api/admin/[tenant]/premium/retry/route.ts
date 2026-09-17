import { currentUser } from '@/lib/auth';
import { recordActivity } from '@/lib/admin/activity';
import { getTenantBySlug } from '@/lib/tenant-queries';
import { dispatchPremiumRelease } from '@/lib/premium/dispatch';
import { premiumWorkspaceState } from '@/lib/premium/queries';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const user = await currentUser();
  if (!user) return new Response('Não autorizado', { status: 401 });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return new Response('Origem inválida', { status: 403 });
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return new Response('Cliente não encontrado', { status: 404 });
  const premium = await premiumWorkspaceState(tenant);
  if (
    tenant.maintenanceMode !== 'converting' ||
    premium.conversion?.status !== 'exported' ||
    !premium.conversion.error ||
    !premium.project
  )
    return Response.json(
      { error: 'Esta publicação não está disponível para nova tentativa.' },
      { status: 409 },
    );
  const dispatch = await dispatchPremiumRelease(premium.project.key);
  if (dispatch !== 'started')
    return Response.json(
      {
        error:
          'O executor imediato está indisponível. A entrega continua preservada para nova tentativa.',
      },
      { status: 503 },
    );
  await recordActivity({
    actor: user,
    actorType: 'user',
    tenant,
    action: 'premium.release.retry',
    result: 'started',
    resourceType: 'premium_conversion',
    resourceId: premium.conversion.id,
    operationId: `premium:release:retry:${premium.conversion.id}`,
    summary: `${user.name} reiniciou a publicação Premium de ${tenant.name}`,
    detail: { projectKey: premium.project.key },
  });
  return Response.json({ dispatch }, { status: 202 });
}
