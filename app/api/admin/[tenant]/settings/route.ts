import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { recordActivity } from '@/lib/admin/activity';
import { db } from '@/lib/db';
import { getTenantBySlug, setBrandLogo } from '@/lib/tenant-queries';
import { intakeWriteSchema } from '@/lib/tenant-intake';
import { contactsSchema, primaryWhatsapp } from '@/lib/tenant-contacts';
import {
  brandColorsSchema,
  directionHasRequiredReference,
  tenantDetailsSchema,
} from '@/lib/admin/tenant-input';
import { intakeForForm } from '@/lib/tenant-intake';
import {
  studioDirectionOf,
  studioDirectionSchema,
} from '@/lib/studio/directions';
import { tenantBlobPrefix } from '@/lib/blob/tenant-files';
import { sitesWriteGuard } from '@/lib/sites-maintenance';
import {
  parseBoundedPublicJson,
  PublicInputTooLargeError,
} from '@/lib/public-input.mjs';

const patch = z
  .object({
    name: tenantDetailsSchema.shape.name.optional(),
    contacts: contactsSchema.optional(),
    contactEmail: tenantDetailsSchema.shape.contactEmail.nullable().optional(),
    logoUrl: z.url().nullable().optional(),
    intake: intakeWriteSchema.optional(),
    direction: studioDirectionSchema.optional(),
    colors: brandColorsSchema.optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    'Informe os dados que deseja alterar.',
  );

function belongsToTenant(slug: string, url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      parsed.pathname.includes(`/${tenantBlobPrefix(slug)}`)
    );
  } catch {
    return false;
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const operator = await currentUser();
  if (!operator) return new Response('Não autorizado', { status: 401 });
  const maintenance = await sitesWriteGuard();
  if (maintenance) return maintenance;
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return new Response('Cliente não encontrado', { status: 404 });

  let body: unknown;
  try {
    body = await parseBoundedPublicJson(request, 128_000);
  } catch (error) {
    return Response.json(
      { error: 'Dados inválidos.' },
      { status: error instanceof PublicInputTooLargeError ? 413 : 400 },
    );
  }
  const parsed = patch.safeParse(body);
  if (!parsed.success)
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' },
      { status: 400 },
    );
  const input = parsed.data;
  if (input.logoUrl) {
    const known = (await db()`
      select 1 from images
      where tenant_id = ${tenant.id} and url = ${input.logoUrl}
      limit 1
    `) as unknown[];
    if (!known.length && !belongsToTenant(tenant.slug, input.logoUrl))
      return Response.json(
        { error: 'Escolha um logo enviado para este cliente.' },
        { status: 409 },
      );
  }

  const contacts = input.contacts;
  const currentDirection = studioDirectionOf(tenant.brand);
  const nextDirection = input.direction ?? currentDirection;
  const nextIntake = input.intake ??
    intakeForForm(tenant.brief.intake) ?? { references: [] };
  if (
    !directionHasRequiredReference({
      direction: nextDirection,
      references: nextIntake.references,
    })
  )
    return Response.json(
      {
        error:
          'Na vibe Referência, informe o link visual que deve orientar o projeto.',
      },
      { status: 400 },
    );
  await db()`
    update tenants set
      name = case
        when ${input.name !== undefined} then ${input.name ?? null}
        else name
      end,
      contacts = case
        when ${contacts !== undefined}
          then ${JSON.stringify(contacts ?? {})}::jsonb
        else contacts
      end,
      whatsapp = case
        when ${contacts !== undefined}
          then ${contacts ? primaryWhatsapp(contacts) : null}
        else whatsapp
      end,
      contact_email = case
        when ${input.contactEmail !== undefined}
          then ${input.contactEmail ?? null}
        else contact_email
      end,
      brief = brief || case
        when ${input.intake !== undefined}
          then jsonb_build_object('intake', ${JSON.stringify(input.intake ?? {})}::jsonb)
        else '{}'::jsonb
      end,
      brand = (brand - case when ${input.direction !== undefined} then 'vibe' else '__none__' end)
        || case
          when ${input.direction !== undefined}
            then jsonb_build_object('direction', ${input.direction ?? currentDirection}::text)
          else '{}'::jsonb
        end
        || case
          when ${input.colors !== undefined}
            then jsonb_build_object(
              'accent', ${input.colors?.primary ?? null}::text,
              'accentAlt', ${input.colors?.secondary ?? null}::text,
              'highlight', ${input.colors?.highlight ?? null}::text,
              'paletteSource', 'operador'
            )
          else '{}'::jsonb
        end,
      updated_at = now()
    where id = ${tenant.id}
  `;

  let brand = tenant.brand;
  if (input.logoUrl !== undefined)
    brand = await setBrandLogo(tenant.id, input.logoUrl);

  await recordActivity({
    actor: operator,
    tenant,
    action: 'tenant.settings.update',
    summary: `${operator.name} atualizou os dados de ${tenant.name}`,
    resourceType: 'tenant',
    resourceId: tenant.id,
    detail: { fields: Object.keys(input) },
  });
  return Response.json({ ok: true, brand });
}
