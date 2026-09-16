import { checked, text } from '@/lib/form-data';
import { db } from '@/lib/db';
import { premiumBridgeProject } from '@/lib/premium/bridge';

const RESERVED = new Set([
  'tenant',
  'page',
  'redirect',
  'attribution',
  'consent',
  'company_website',
  'whatsapp_optin',
]);

export async function POST(request: Request) {
  const project = await premiumBridgeProject(request);
  if (!project) return new Response('Não autorizado', { status: 401 });
  const form = await request.formData();
  const pagePath = text(form, 'page', '/');
  const redirect = text(form, 'redirect', '/obrigado');
  if (!redirect.startsWith('/') || redirect.startsWith('//'))
    return Response.json(
      { error: 'Redirecionamento inválido.' },
      { status: 400 },
    );
  if (text(form, 'company_website')) return Response.json({ redirect });

  const fields: Record<string, string> = {};
  for (const [key, value] of form.entries())
    if (!RESERVED.has(key) && typeof value === 'string') fields[key] = value;
  let source: Record<string, unknown> = {};
  try {
    source = JSON.parse(text(form, 'attribution', '{}'));
  } catch {
    source = {};
  }
  const pages = (await db()`
    select id from pages
    where tenant_id = ${project.tenantId}
      and slug = ${pagePath.replace(/^\/+|\/+$/g, '')}
    limit 1
  `) as { id: string }[];
  const consent = {
    given: checked(form, 'consent'),
    whatsappOptIn: checked(form, 'whatsapp_optin'),
    at: new Date().toISOString(),
    version: '1',
  };
  await db().transaction([
    db()`
      insert into leads (tenant_id, page_id, name, email, phone, fields, source, consent)
      values (
        ${project.tenantId}, ${pages[0]?.id ?? null},
        ${fields.nome ?? fields.name ?? null}, ${fields.email ?? null},
        ${fields.telefone ?? fields.phone ?? fields.whatsapp ?? null},
        ${JSON.stringify(fields)}::jsonb, ${JSON.stringify(source)}::jsonb,
        ${JSON.stringify(consent)}::jsonb
      )
    `,
    db()`
      insert into events (tenant_id, type, path, source)
      values (${project.tenantId}, 'form_submit', ${pagePath}, ${JSON.stringify(source)}::jsonb)
    `,
  ]);
  return Response.json({ redirect });
}
