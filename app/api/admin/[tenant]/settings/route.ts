import { z } from 'zod';
import { isAuthenticated } from '@/lib/auth';
import { db } from '@/lib/db';
import { getTenantBySlug } from '@/lib/tenant-queries';

const patch = z.object({
  name: z.string().min(1).max(80).optional(),
  whatsapp: z.string().max(20).nullable().optional(),
  contactEmail: z.string().max(120).nullable().optional(),
  logoUrl: z.url().nullable().optional(),
});

/** Ajusta dados do cliente. O logo entra em brand.logoUrl e a nav e o rodapé passam a usá-lo. */
export async function PATCH(request: Request, { params }: { params: Promise<{ tenant: string }> }) {
  if (!(await isAuthenticated())) return new Response('Não autorizado', { status: 401 });
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return new Response('Cliente não encontrado', { status: 404 });

  const parsed = patch.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const input = parsed.data;

  const brand = { ...tenant.brand };
  if (input.logoUrl !== undefined) {
    if (input.logoUrl) brand.logoUrl = input.logoUrl;
    else delete brand.logoUrl;
  }

  await db()`
    update tenants set
      name = ${input.name ?? tenant.name},
      whatsapp = ${input.whatsapp === undefined ? tenant.whatsapp : input.whatsapp},
      contact_email = ${input.contactEmail === undefined ? tenant.contactEmail : input.contactEmail},
      brand = ${JSON.stringify(brand)}::jsonb,
      updated_at = now()
    where id = ${tenant.id}
  `;
  return Response.json({ ok: true, brand });
}
