import { isAuthenticated } from '@/lib/auth';
import { getTenantBySlug } from '@/lib/tenant-queries';
import { intakeSchema } from '@/lib/tenant-intake';
import { normalizeSocialUrl, parseSocialRecord } from '@/lib/social-profile';
import { markSocialReading, syncSocialProfile } from '@/lib/ai/social';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function resolve(params: Promise<{ tenant: string }>) {
  if (!(await isAuthenticated()))
    return { error: new Response('Não autorizado', { status: 401 }) };
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant)
    return { error: new Response('Cliente não encontrado', { status: 404 }) };
  return { tenant };
}

/** Estado da última leitura, usado pelo card enquanto ela ainda corre. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const resolved = await resolve(params);
  if (resolved.error) return resolved.error;
  return Response.json({
    social: parseSocialRecord(resolved.tenant.brief.social),
  });
}

/** Releitura pedida pelo operador: aguarda e devolve o resultado final. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const resolved = await resolve(params);
  if (resolved.error) return resolved.error;
  const { tenant } = resolved;
  const intake = intakeSchema.safeParse(tenant.brief.intake);
  const socialUrl = intake.success ? intake.data.socialUrl : '';
  if (!socialUrl)
    return Response.json(
      { error: 'Informe um perfil de rede social no briefing.' },
      { status: 400 },
    );
  const normalized = normalizeSocialUrl(socialUrl);
  const reading = normalized
    ? await markSocialReading(tenant.id, normalized)
    : null;
  const social = reading ? await syncSocialProfile(tenant, reading) : null;
  if (!social)
    return Response.json(
      {
        error:
          'O perfil mudou ou o cliente foi excluído durante a leitura. Atualize os dados.',
      },
      { status: 409 },
    );
  return Response.json({ social });
}
