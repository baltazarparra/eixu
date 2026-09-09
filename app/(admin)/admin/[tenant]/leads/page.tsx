import { notFound, redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { db } from '@/lib/db';
import { getTenantBySlug } from '@/lib/tenant-queries';
import { updateLeadStatusAction } from '../../actions';

export const dynamic = 'force-dynamic';

const STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'] as const;
const LABELS: Record<string, string> = {
  new: 'novo',
  contacted: 'contatado',
  qualified: 'qualificado',
  won: 'ganho',
  lost: 'perdido',
};

type LeadRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  fields: Record<string, string>;
  source: Record<string, string>;
  status: string;
  created_at: string;
};

export default async function LeadsPage({ params }: { params: Promise<{ tenant: string }> }) {
  if (!(await isAuthenticated())) redirect('/admin/login');
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const leads = (await db()`
    select id, name, email, phone, fields, source, status, created_at
    from leads where tenant_id = ${tenant.id}
    order by created_at desc limit 300
  `) as LeadRow[];

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <header className="mb-10">
        <a href={`/admin/${tenant.slug}`} className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]">
          {tenant.name}
        </a>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em]">Leads</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{leads.length} registros.</p>
      </header>

      {leads.length === 0 ? (
        <p className="rounded-lg border border-dashed px-6 py-12 text-center text-sm text-[var(--color-muted)]">
          Nenhum lead ainda. Eles aparecem aqui assim que o formulário do site for enviado.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-[var(--color-surface)] text-left text-xs uppercase tracking-[0.1em] text-[var(--color-muted)]">
                <th className="px-4 py-3 font-medium">Contato</th>
                <th className="px-4 py-3 font-medium">Origem</th>
                <th className="px-4 py-3 font-medium">Campanha</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{lead.name ?? '(sem nome)'}</div>
                    <div className="text-xs text-[var(--color-muted)]">
                      {[lead.email, lead.phone].filter(Boolean).join(' · ') || '(sem contato)'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-muted)]">
                    {lead.source?.utm_source ?? (lead.source?.referrer ? 'referência' : 'direto')}
                    {lead.source?.utm_medium ? ` / ${lead.source.utm_medium}` : ''}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted)]">
                    {lead.source?.utm_campaign ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-muted)]">
                    {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <form action={updateLeadStatusAction} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={lead.id} />
                      <input type="hidden" name="tenant" value={tenant.slug} />
                      <select
                        name="status"
                        aria-label={`Status do lead ${lead.name ?? 'sem nome'}`}
                        defaultValue={lead.status}
                        className="rounded-md border bg-[var(--color-surface)] px-2 py-1.5 text-xs"
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {LABELS[status]}
                          </option>
                        ))}
                      </select>
                      <button className="rounded-md border px-2.5 py-1.5 text-xs hover:bg-[var(--color-surface)]">
                        Salvar
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
