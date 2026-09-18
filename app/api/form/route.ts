import { db } from '@/lib/db';
import { checked, text } from '@/lib/form-data';
import { publicTenantBySlug } from '@/lib/site-availability';
import {
  matchesTenantOrigin,
  tenantRedirectUrl,
} from '@/lib/public-origin.mjs';
import {
  parseBoundedPublicFormData,
  parseBoundedPublicSource,
  PublicInputTooLargeError,
} from '@/lib/public-input.mjs';

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
  let form: FormData;
  try {
    form = await parseBoundedPublicFormData(request, 256_000);
  } catch (error) {
    return new Response(
      error instanceof PublicInputTooLargeError
        ? 'Formulário acima do limite.'
        : 'Formulário inválido.',
      { status: error instanceof PublicInputTooLargeError ? 413 : 400 },
    );
  }
  const slug = text(form, 'tenant');
  const pagePath = text(form, 'page', '/').slice(0, 500);
  const redirectTo = text(form, 'redirect', '/obrigado');

  const tenant = await publicTenantBySlug(slug);
  if (!tenant) return new Response('Site indisponível.', { status: 404 });
  const safeRedirect = tenantRedirectUrl(tenant.slug, redirectTo);
  if (!safeRedirect) return new Response('Site indisponível.', { status: 404 });
  const origin = request.headers.get('origin');
  if (!matchesTenantOrigin(origin, tenant.slug, { allowMissing: true }))
    return new Response('Origem inválida.', { status: 403 });

  // Campo-armadilha: preenchido significa robô.
  if (text(form, 'company_website')) {
    return Response.redirect(safeRedirect, 303);
  }

  const fields: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (
      Object.keys(fields).length < 40 &&
      key.length <= 64 &&
      !RESERVED.has(key) &&
      typeof value === 'string'
    )
      fields[key] = value.slice(0, 4_000);
  }

  const source = parseBoundedPublicSource(text(form, 'attribution', '{}'));

  const consent = {
    given: checked(form, 'consent'),
    whatsappOptIn: checked(form, 'whatsapp_optin'),
    at: new Date().toISOString(),
    version: '1',
  };

  await db()`
    insert into leads (tenant_id, page_path, name, email, phone, fields, source, consent)
    values (
      ${tenant.id},
      ${pagePath},
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

  return Response.redirect(safeRedirect, 303);
}
