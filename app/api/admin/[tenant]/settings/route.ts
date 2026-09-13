import { z } from 'zod';
import { after } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { db } from '@/lib/db';
import { getTenantBySlug } from '@/lib/tenant-queries';
import { intakeSchema, intakeWriteSchema } from '@/lib/tenant-intake';
import { contactsSchema, primaryWhatsapp } from '@/lib/tenant-contacts';
import { tenantDetailsSchema } from '@/lib/admin/tenant-input';
import { vibeOf, vibeSchema } from '@/lib/design/vibes';
import { canApplyLogo } from '@/lib/images/logo-access';
import { applyBrandLogo, applyBrandLogoDark } from '@/lib/images/logo-apply';
import { normalizeSocialUrl, parseSocialRecord } from '@/lib/social-profile';
import {
  clearSocialProfile,
  markSocialReading,
  syncSocialProfile,
} from '@/lib/ai/social';
import { activeRun } from '@/lib/generation/runs';

const patch = z
  .object({
    name: tenantDetailsSchema.shape.name.optional(),
    contacts: contactsSchema.optional(),
    contactEmail: tenantDetailsSchema.shape.contactEmail.nullable().optional(),
    logoUrl: z.url().nullable().optional(),
    /** Versão do logo para superfície escura; null remove a escolha. */
    logoDarkUrl: z.url().nullable().optional(),
    intake: intakeWriteSchema.optional(),
    vibe: vibeSchema.optional(),
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
  const nameChanged = input.name !== undefined && input.name !== tenant.name;

  // O mesmo portão vale para o logo principal e para a versão de fundo
  // escuro: logo da biblioteca deste cliente ou upload no caminho dele.
  for (const url of [input.logoUrl, input.logoDarkUrl]) {
    if (!url) continue;
    const images =
      (await db()`select kind, status from images where tenant_id = ${tenant.id} and url = ${url} limit 1`) as {
        kind: string;
        status: string;
      }[];
    if (!canApplyLogo(tenant.slug, url, images[0]))
      return Response.json(
        {
          error:
            'Escolha um logo disponível deste cliente ou envie o arquivo em Dados.',
        },
        { status: 409 },
      );
  }

  const previousIntake = intakeSchema.safeParse(tenant.brief.intake).data;
  const previousSocial = previousIntake?.socialUrl;
  const vibeChanged =
    input.vibe !== undefined && input.vibe !== vibeOf(tenant.brand);
  const storyChanged =
    input.intake !== undefined &&
    input.intake.story !== (previousIntake?.story ?? '');
  const referenceChanged =
    input.intake !== undefined &&
    JSON.stringify(input.intake.references) !==
      JSON.stringify(previousIntake?.references ?? []);
  const currentSiteChanged =
    input.intake !== undefined &&
    input.intake.currentSiteUrl !== (previousIntake?.currentSiteUrl ?? '');
  const directionChanged =
    nameChanged ||
    vibeChanged ||
    storyChanged ||
    referenceChanged ||
    currentSiteChanged;
  if (directionChanged && (await activeRun(tenant.id)))
    return Response.json(
      {
        error:
          'Pause a geração em andamento antes de alterar o nome, a história, o site atual, a referência ou a direção visual.',
      },
      { status: 409 },
    );

  // whatsapp continua sendo coluna própria, derivada da lista de contatos:
  // /go/wa, botão flutuante e JSON-LD seguem lendo um número só.
  const contacts = input.contacts;
  await db()`
    update tenants set
      name = case when ${input.name !== undefined} then ${input.name ?? null} else name end,
      contacts = case when ${contacts !== undefined} then ${JSON.stringify(contacts ?? {})}::jsonb else contacts end,
      whatsapp = case when ${contacts !== undefined} then ${contacts ? primaryWhatsapp(contacts) : null} else whatsapp end,
      contact_email = case when ${input.contactEmail !== undefined} then ${input.contactEmail ?? null} else contact_email end,
      brief = (case when ${nameChanged || storyChanged || referenceChanged || currentSiteChanged}
                    then (case when ${nameChanged || currentSiteChanged || storyChanged} then brief - 'currentSite' else brief end)
                      - 'audience' - 'offer' - 'goal' - 'personality' - 'evidence' - 'constraints' - 'gaps' - 'pagePlan' - 'imageScenes'
                    else brief end)
              || (case when ${input.intake !== undefined}
                       then jsonb_build_object('intake', ${JSON.stringify(input.intake ?? {})}::jsonb)
                       else '{}'::jsonb end),
      brand = case when ${vibeChanged}
                   then (brand - 'design') || jsonb_build_object('vibe', ${input.vibe ?? null}::text)
                   else brand end,
      updated_at = now()
    where id = ${tenant.id}
  `;
  // O logo principal agenda medição e versão escura; a versão escura escolhida
  // à mão só troca o campo. As duas podem vir no mesmo pedido, nessa ordem.
  let brand = tenant.brand;
  if (input.logoUrl !== undefined)
    brand = await applyBrandLogo(tenant, input.logoUrl);
  if (input.logoDarkUrl !== undefined)
    brand = await applyBrandLogoDark({ ...tenant, brand }, input.logoDarkUrl);

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
  return Response.json({
    ok: true,
    brand,
    social,
    regenerationRequired: directionChanged,
  });
}
