import { currentUser } from '@/lib/auth';
import { recordActivity } from '@/lib/admin/activity';
import { getTenantBySlug } from '@/lib/tenant-queries';
import {
  PremiumConversionError,
  requestPremiumConversion,
} from '@/lib/premium/queries';
import { dispatchPremiumConversion } from '@/lib/premium/dispatch';

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

  try {
    const conversion = await requestPremiumConversion({
      tenantId: tenant.id,
      requestedBy: user,
    });
    const dispatch = await dispatchPremiumConversion(conversion.id);
    await recordActivity({
      actor: user,
      actorType: 'user',
      tenant,
      action: 'premium.conversion.request',
      result: 'started',
      resourceType: 'premium_conversion',
      resourceId: conversion.id,
      operationId: `premium:conversion:${conversion.id}`,
      summary: `${user.name} iniciou a conversão Premium de ${tenant.name}`,
      detail: {
        projectKey: conversion.projectKey,
        sourceHash: conversion.sourceHash,
        dispatch,
      },
    });
    return Response.json({ conversion, dispatch }, { status: 202 });
  } catch (error) {
    if (error instanceof PremiumConversionError)
      return Response.json({ error: error.message }, { status: error.status });
    console.error('[premium] falha ao pedir conversão', {
      tenantId: tenant.id,
      error: error instanceof Error ? error.name : 'unknown',
    });
    return Response.json(
      { error: 'Não foi possível iniciar a conversão Premium.' },
      { status: 500 },
    );
  }
}
