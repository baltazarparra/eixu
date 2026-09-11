import { z } from 'zod';
import { after } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { db } from '@/lib/db';
import { getTenantBySlug, setBrandLogo } from '@/lib/tenant-queries';
import { intakeSchema } from '@/lib/tenant-intake';
import { tenantDetailsSchema } from '@/lib/admin/tenant-input';
import { canApplyLogo } from '@/lib/images/logo-access';
import { normalizeSocialUrl, parseSocialRecord } from '@/lib/social-profile';
import {
  clearSocialProfile,
  markSocialReading,
  syncSocialProfile,
} from '@/lib/ai/social';

const patch = z
  .object({
    name: tenantDetailsSchema.shape.name.optional(),
    whatsapp: tenantDetailsSchema.shape.whatsapp.nullable().optional(),
    contactEmail: tenantDetailsSchema.shape.contactEmail.nullable().optional(),
    logoUrl: z.url().nullable().optional(),
    intake: intakeSchema.optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    'Informe os dados que deseja alterar.',
  );

/** Ajusta dados do cliente. O logo entra em brand.logoUrl e a nav e o rodapé passam a usá-lo. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  if (!(await isAuthenticated()))
    return new Response('Não autorizado', { status: 401 });
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return new Response('Cliente não encontrado', { status: 404 });

  const parsed = patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  const input = parsed.data;

  if (input.logoUrl) {
    const images =
      (await db()`select kind, status from images where tenant_id = ${tenant.id} and url = ${input.logoUrl} limit 1`) as {
        kind: string;
        status: string;
      }[];
    if (!canApplyLogo(tenant.slug, input.logoUrl, images[0]))
      return Response.json(
        {
          error:
            'Escolha um logo aprovado deste cliente ou envie o arquivo em Dados.',
        },
        { status: 409 },
      );
  }

  const previousSocial = intakeSchema.safeParse(tenant.brief.intake).data
    ?.socialUrl;

  await db()`
    update tenants set
      name = case when ${input.name !== undefined} then ${input.name ?? null} else name end,
      whatsapp = case when ${input.whatsapp !== undefined} then ${input.whatsapp ?? null} else whatsapp end,
      contact_email = case when ${input.contactEmail !== undefined} then ${input.contactEmail ?? null} else contact_email end,
      brief = case when ${input.intake !== undefined} then brief || jsonb_build_object('intake', ${JSON.stringify(input.intake ?? {})}::jsonb) else brief end,
      updated_at = now()
    where id = ${tenant.id}
  `;
  const brand =
    input.logoUrl === undefined
      ? tenant.brand
      : await setBrandLogo(tenant.id, input.logoUrl);

  // O perfil vive em brief.social, fora de brief.intake, porque o update acima
  // substitui o intake inteiro. A leitura corre depois da resposta.
  let social = parseSocialRecord(tenant.brief.social);
  const nextSocial = input.intake?.socialUrl;
  if (nextSocial !== undefined && nextSocial !== (previousSocial ?? '')) {
    const normalized = nextSocial ? normalizeSocialUrl(nextSocial) : null;
    if (normalized) {
      const reading = await markSocialReading(tenant.id, normalized);
      social = reading;
      if (reading)
        after(() =>
          syncSocialProfile({ id: tenant.id, slug: tenant.slug }, reading),
        );
    } else {
      social = null;
      await clearSocialProfile(tenant.id);
    }
  }
  return Response.json({ ok: true, brand, social });
}
