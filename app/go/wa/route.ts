import { db } from '@/lib/db';
import { getTenantBySlug } from '@/lib/tenant-queries';
import { tenantFromHost } from '@/lib/tenant-host';
import { whatsappAt } from '@/lib/tenant-contacts';

/**
 * Redirecionador de WhatsApp rastreado. Registra o clique e injeta a origem
 * na mensagem, para o atendimento saber de qual campanha veio o contato.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get('host') ?? '';
  const slug = url.searchParams.get('t') || tenantFromHost(host);
  if (!slug) return Response.redirect(new URL('/', request.url), 302);
  const tenant = await getTenantBySlug(slug);

  if (!tenant?.whatsapp) {
    return Response.redirect(new URL('/', request.url), 302);
  }

  const campaign = url.searchParams.get('utm_campaign') || '';
  const from = url.searchParams.get('from') || '/';
  const session = url.searchParams.get('sid')?.slice(0, 160) || null;
  // `n` escolhe outro WhatsApp do cadastro; índice ausente ou inválido usa o
  // número principal, que é o que o botão flutuante e os CTAs já enviam.
  const index = Number(url.searchParams.get('n'));
  const chosen =
    Number.isInteger(index) && index >= 0
      ? whatsappAt(tenant.contacts, index)
      : null;
  const number = (chosen ?? tenant.whatsapp).replace(/\D/g, '');
  const text = campaign
    ? `Oi! Vim pelo site (${from}), campanha ${campaign}.`
    : `Oi! Vim pelo site (${from}).`;

  try {
    await db()`
      insert into events (tenant_id, type, path, session_id, source)
      values (${tenant.id}, 'whatsapp_click', ${from}, ${session},
              ${JSON.stringify(Object.fromEntries(url.searchParams))}::jsonb)
    `;
  } catch {
    // Falha de registro não pode impedir o contato.
  }

  return Response.redirect(
    `https://wa.me/${number}?text=${encodeURIComponent(text)}`,
    302,
  );
}
