import { z } from 'zod';
import {
  failPremiumConversion,
  markPremiumExported,
  markPremiumDeploying,
  markPremiumReleaseFailed,
} from '@/lib/premium/queries';
import { premiumWorkerAuthorized } from '@/lib/premium/worker-auth';

const updateSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('exported'),
    branch: z.string().min(1).max(200),
    pullRequestUrl: z.url().max(500),
  }),
  z.object({
    status: z.literal('failed'),
    error: z.string().min(1).max(4000),
  }),
  z.object({ status: z.literal('deploying') }),
  z.object({
    status: z.literal('release_failed'),
    error: z.string().min(1).max(4000),
  }),
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ conversion: string }> },
) {
  if (!premiumWorkerAuthorized(request))
    return new Response('Não autorizado', { status: 401 });
  const { conversion } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(conversion))
    return new Response('Conversão inválida', { status: 400 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: 'Atualização inválida.' }, { status: 400 });
  let updated: boolean;
  if (parsed.data.status === 'exported')
    updated = await markPremiumExported({
      conversionId: conversion,
      branch: parsed.data.branch,
      pullRequestUrl: parsed.data.pullRequestUrl,
    });
  else if (parsed.data.status === 'failed')
    updated = await failPremiumConversion({
      conversionId: conversion,
      error: parsed.data.error,
    });
  else if (parsed.data.status === 'deploying')
    updated = await markPremiumDeploying(conversion);
  else
    updated = await markPremiumReleaseFailed({
      conversionId: conversion,
      error: parsed.data.error,
    });
  return updated
    ? Response.json({ ok: true })
    : Response.json(
        { error: 'Conversão ausente ou em outro estado.' },
        { status: 409 },
      );
}
