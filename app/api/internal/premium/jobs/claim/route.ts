import { claimPremiumConversion } from '@/lib/premium/queries';
import { premiumWorkerAuthorized } from '@/lib/premium/worker-auth';
import { z } from 'zod';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!premiumWorkerAuthorized(request))
    return new Response('Não autorizado', { status: 401 });
  const body = await request.json().catch(() => ({}));
  const parsed = z
    .object({ conversionId: z.uuid().optional() })
    .safeParse(body);
  if (!parsed.success)
    return Response.json({ error: 'Reserva inválida.' }, { status: 400 });
  const job = await claimPremiumConversion(parsed.data.conversionId);
  return job ? Response.json({ job }) : new Response(null, { status: 204 });
}
