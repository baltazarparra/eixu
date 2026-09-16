import { claimPremiumConversion } from '@/lib/premium/queries';
import { premiumWorkerAuthorized } from '@/lib/premium/worker-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!premiumWorkerAuthorized(request))
    return new Response('Não autorizado', { status: 401 });
  const job = await claimPremiumConversion();
  return job ? Response.json({ job }) : new Response(null, { status: 204 });
}
