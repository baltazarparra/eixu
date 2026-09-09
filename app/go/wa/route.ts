import { db } from '@/lib/db';
import { getTenantBySlug } from '@/lib/tenant-queries';

/**
 * Redirecionador de WhatsApp rastreado. Registra o clique e injeta a origem
 * na mensagem, para o atendimento saber de qual campanha veio o contato.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get('host') ?? '';
  const slug = url.searchParams.get('t') || host.split(':')[0].split('.')[0];
  const tenant = await getTenantBySlug(slug);

  if (!tenant?.whatsapp) {
    return Response.redirect(new URL('/', request.url), 302);
  }

  const campaign = url.searchParams.get('utm_campaign') || '';
  const from = url.searchParams.get('from') || '/';
  const number = tenant.whatsapp.replace(/\D/g, '');
  const text = campaign
    ? `Oi! Vim pelo site (${from}), campanha ${campaign}.`
    : `Oi! Vim pelo site (${from}).`;

  try {
    await db()`
      insert into events (tenant_id, type, path, source)
      values (${tenant.id}, 'whatsapp_click', ${from},
              ${JSON.stringify(Object.fromEntries(url.searchParams))}::jsonb)
    `;
  } catch {
    // Falha de registro não pode impedir o contato.
  }

  return Response.redirect(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, 302);
}
