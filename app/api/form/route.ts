import { db } from '@/lib/db';
import { checked, text } from '@/lib/form-data';
import { getPage, getTenantBySlug } from '@/lib/tenant-queries';

const RESERVED = new Set([
  'tenant',
  'page',
  'redirect',
  'attribution',
  'consent',
  'company_website',
  'whatsapp_optin',
]);

/**
 * Recebe o POST nativo do bloco de formulário. Sem JavaScript de cliente:
 * grava o lead, registra o evento e redireciona para a página de obrigado.
 */
export async function POST(request: Request) {
  if (new URL(request.url).searchParams.get('preview') === '1')
    return Response.json(
      { error: 'Envios desativados na prévia.' },
      { status: 409 },
    );
  const form = await request.formData();
  const origin = new URL(request.url).origin;
  const slug = text(form, 'tenant');
  const pagePath = text(form, 'page', '/');
  const redirectTo = text(form, 'redirect', '/obrigado');

  // Em preview não há subdomínio, então o tenant viaja na query.
  const carry = new URL(request.url).searchParams.get('__tenant') ?? '';
  const target = (path: string) =>
    carry
      ? `${origin}${path}${path.includes('?') ? '&' : '?'}__tenant=${carry}`
      : `${origin}${path}`;

  // Campo-armadilha: preenchido significa robô.
  if (text(form, 'company_website')) {
    return Response.redirect(target(redirectTo), 303);
  }

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return Response.redirect(`${origin}/`, 303);

  const fields: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (!RESERVED.has(key) && typeof value === 'string') fields[key] = value;
  }

  let source: Record<string, unknown> = {};
  try {
    source = JSON.parse(text(form, 'attribution', '{}'));
  } catch {
    source = {};
  }

  const page = await getPage(tenant.id, pagePath.replace(/^\//, ''));
  const consent = {
    given: checked(form, 'consent'),
    whatsappOptIn: checked(form, 'whatsapp_optin'),
    at: new Date().toISOString(),
    version: '1',
  };

  await db()`
    insert into leads (tenant_id, page_id, name, email, phone, fields, source, consent)
    values (
      ${tenant.id},
      ${page?.id ?? null},
      ${fields.nome ?? fields.name ?? null},
      ${fields.email ?? null},
      ${fields.telefone ?? fields.phone ?? fields.whatsapp ?? null},
      ${JSON.stringify(fields)}::jsonb,
      ${JSON.stringify(source)}::jsonb,
      ${JSON.stringify(consent)}::jsonb
    )
  `;

  await db()`
    insert into events (tenant_id, type, path, source)
    values (${tenant.id}, 'form_submit', ${pagePath}, ${JSON.stringify(source)}::jsonb)
  `;

  return Response.redirect(target(redirectTo), 303);
}
