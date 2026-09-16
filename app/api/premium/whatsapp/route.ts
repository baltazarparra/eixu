import { db } from '@/lib/db';
import { contactsOf, whatsappAt } from '@/lib/tenant-contacts';
import { premiumBridgeProject } from '@/lib/premium/bridge';

export async function POST(request: Request) {
  const project = await premiumBridgeProject(request);
  if (!project) return new Response('Não autorizado', { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    campaign?: unknown;
    from?: unknown;
    session?: unknown;
    index?: unknown;
    source?: unknown;
  } | null;
  const rows = (await db()`
    select contacts, whatsapp from tenants where id = ${project.tenantId} limit 1
  `) as { contacts: unknown; whatsapp: string | null }[];
  const tenant = rows[0];
  if (!tenant?.whatsapp) return Response.json({ redirect: '/' });
  const contacts = contactsOf(tenant.contacts, tenant.whatsapp);
  const index = Number(body?.index);
  const chosen =
    Number.isInteger(index) && index >= 0 ? whatsappAt(contacts, index) : null;
  const number = (chosen ?? tenant.whatsapp).replace(/\D/g, '');
  const from = typeof body?.from === 'string' ? body.from.slice(0, 500) : '/';
  const campaign =
    typeof body?.campaign === 'string' ? body.campaign.slice(0, 300) : '';
  const session =
    typeof body?.session === 'string' ? body.session.slice(0, 160) : null;
  const source =
    body?.source && typeof body.source === 'object' ? body.source : {};
  const message = campaign
    ? `Oi! Vim pelo site (${from}), campanha ${campaign}.`
    : `Oi! Vim pelo site (${from}).`;
  try {
    await db()`
      insert into events (tenant_id, type, path, session_id, source)
      values (${project.tenantId}, 'whatsapp_click', ${from}, ${session},
              ${JSON.stringify(source)}::jsonb)
    `;
  } catch {
    // O contato continua mesmo se o evento falhar.
  }
  return Response.json({
    redirect: `https://wa.me/${number}?text=${encodeURIComponent(message)}`,
  });
}
