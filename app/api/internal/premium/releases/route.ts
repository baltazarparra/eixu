import { z } from 'zod';
import { activatePremiumRelease } from '@/lib/premium/queries';
import { premiumWorkerAuthorized } from '@/lib/premium/worker-auth';

const releaseSchema = z.object({
  conversionId: z.uuid().optional(),
  projectKey: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(63),
  commitSha: z.string().regex(/^[0-9a-f]{40}$/i),
  deploymentId: z.string().min(1).max(200),
  deploymentUrl: z.url().max(500),
  vercelProjectId: z.string().min(1).max(200),
  manifest: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(request: Request) {
  if (!premiumWorkerAuthorized(request))
    return new Response('Não autorizado', { status: 401 });
  const parsed = releaseSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      { error: 'Recibo de release inválido.' },
      { status: 400 },
    );
  const activated = await activatePremiumRelease(parsed.data);
  return activated
    ? Response.json({ ok: true })
    : Response.json(
        { error: 'O projeto Premium não pode ser ativado neste estado.' },
        { status: 409 },
      );
}
