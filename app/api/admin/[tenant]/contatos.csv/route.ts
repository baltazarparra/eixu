import { isAuthenticated } from '@/lib/auth';
import { db } from '@/lib/db';
import { getTenantBySlug } from '@/lib/tenant-queries';

export const dynamic = 'force-dynamic';

const cell = (value: unknown) => {
  const text = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
  return `"${text.replace(/"/g, '""')}"`;
};

/** Contatos recebidos pelo formulário, em CSV. Sem gestão: o cliente leva para onde quiser. */
export async function GET(_request: Request, { params }: { params: Promise<{ tenant: string }> }) {
  if (!(await isAuthenticated())) return new Response('Não autorizado', { status: 401 });
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return new Response('Cliente não encontrado', { status: 404 });

  const rows = (await db()`
    select created_at, name, email, phone, fields, source, consent
    from leads where tenant_id = ${tenant.id} order by created_at desc limit 5000
  `) as { created_at: string; name: string; email: string; phone: string; fields: Record<string, string>; source: Record<string, string>; consent: { whatsappOptIn?: boolean } }[];

  const extra = Array.from(new Set(rows.flatMap((row) => Object.keys(row.fields ?? {})))).filter(
    (key) => !['nome', 'name', 'email', 'telefone', 'phone', 'whatsapp'].includes(key),
  );
  const header = ['data', 'nome', 'email', 'telefone', ...extra, 'utm_source', 'utm_medium', 'utm_campaign', 'gclid', 'fbclid', 'pagina', 'optin_whatsapp'];
  const lines = rows.map((row) =>
    [
      new Date(row.created_at).toISOString(),
      row.name,
      row.email,
      row.phone,
      ...extra.map((key) => row.fields?.[key]),
      row.source?.utm_source,
      row.source?.utm_medium,
      row.source?.utm_campaign,
      row.source?.gclid,
      row.source?.fbclid,
      row.source?.landing,
      row.consent?.whatsappOptIn ? 'sim' : 'não',
    ]
      .map(cell)
      .join(','),
  );
  const csv = `﻿${[header.map(cell).join(','), ...lines].join('\r\n')}`;
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="contatos-${tenant.slug}.csv"`,
    },
  });
}
