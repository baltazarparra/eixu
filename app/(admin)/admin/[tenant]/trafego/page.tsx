import { notFound, redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { db } from '@/lib/db';
import { getTenantBySlug } from '@/lib/tenant-queries';
import { saveSpendAction } from '../../actions';

export const dynamic = 'force-dynamic';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default async function TrafficPage({ params }: { params: Promise<{ tenant: string }> }) {
  if (!(await isAuthenticated())) redirect('/admin/login');
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  // Sessões e conversões por campanha, a partir dos eventos de primeira parte.
  // Agrupado por campanha, que é a chave do gasto informado no painel.
  const byCampaign = (await db()`
    select
      coalesce(nullif(source->>'utm_campaign', ''), '(direto)') as campaign,
      string_agg(distinct coalesce(nullif(source->>'utm_source', ''), '(direto)'), ', ') as src,
      count(distinct session_id) filter (where type = 'page_view')  as sessions,
      count(*) filter (where type = 'form_submit')                  as forms,
      count(*) filter (where type = 'whatsapp_click')               as whats
    from events
    where tenant_id = ${tenant.id}
    group by 1
    order by sessions desc
    limit 50
  `) as { campaign: string; src: string; sessions: number; forms: number; whats: number }[];

  const byPage = (await db()`
    select path,
      count(distinct session_id) filter (where type = 'page_view') as sessions,
      count(*) filter (where type in ('form_submit','whatsapp_click')) as conversions
    from events
    where tenant_id = ${tenant.id} and path is not null
    group by 1 order by sessions desc limit 20
  `) as { path: string; sessions: number; conversions: number }[];

  const spendRows = (await db()`
    select campaign, channel, sum(spend_cents) as cents
    from campaign_spend where tenant_id = ${tenant.id}
    group by 1, 2 order by 3 desc
  `) as { campaign: string; channel: string; cents: number }[];

  const spendByCampaign = new Map(spendRows.map((row) => [row.campaign, Number(row.cents)]));
  const totals = byCampaign.reduce(
    (acc, row) => {
      acc.sessions += Number(row.sessions);
      acc.leads += Number(row.forms) + Number(row.whats);
      return acc;
    },
    { sessions: 0, leads: 0 },
  );
  const totalSpend = spendRows.reduce((sum, row) => sum + Number(row.cents), 0);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <header className="mb-10">
        <a href={`/admin/${tenant.slug}`} className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]">
          {tenant.name}
        </a>
        <div className="mt-1 flex items-end justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Tráfego</h1>
          <a
            href={`/api/admin/${tenant.slug}/contatos.csv`}
            className="rounded-md border px-3 py-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            Baixar contatos (CSV)
          </a>
        </div>
      </header>

      <section className="mb-12 grid gap-px overflow-hidden rounded-lg border bg-[var(--color-line)] sm:grid-cols-4">
        <Metric label="Sessões" value={String(totals.sessions)} />
        <Metric label="Leads" value={String(totals.leads)} />
        <Metric
          label="Conversão"
          value={totals.sessions ? `${((totals.leads / totals.sessions) * 100).toFixed(1)}%` : '—'}
        />
        <Metric
          label="Custo por lead"
          value={totalSpend && totals.leads ? money.format(totalSpend / 100 / totals.leads) : '—'}
        />
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em] text-[var(--color-muted)]">Por campanha</h2>
        {byCampaign.length === 0 ? (
          <p className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-[var(--color-muted)]">
            Sem dados ainda. Os números aparecem conforme o site publicado recebe visitas.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-[var(--color-surface)] text-left text-xs uppercase tracking-[0.1em] text-[var(--color-muted)]">
                  <th className="px-4 py-3 font-medium">Campanha</th>
                  <th className="px-4 py-3 font-medium">Origem</th>
                  <th className="px-4 py-3 font-medium">Sessões</th>
                  <th className="px-4 py-3 font-medium">Leads</th>
                  <th className="px-4 py-3 font-medium">Conversão</th>
                  <th className="px-4 py-3 font-medium">Gasto</th>
                  <th className="px-4 py-3 font-medium">CPL</th>
                </tr>
              </thead>
              <tbody>
                {byCampaign.map((row) => {
                  const leads = Number(row.forms) + Number(row.whats);
                  const sessions = Number(row.sessions);
                  const cents = spendByCampaign.get(row.campaign) ?? 0;
                  return (
                    <tr key={row.campaign} className="border-b last:border-0">
                      <td className="px-4 py-3 font-mono text-xs">{row.campaign}</td>
                      <td className="px-4 py-3 text-xs text-[var(--color-muted)]">{row.src}</td>
                      <td className="px-4 py-3">{sessions}</td>
                      <td className="px-4 py-3">{leads}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">
                        {sessions ? `${((leads / sessions) * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{cents ? money.format(cents / 100) : '—'}</td>
                      <td className="px-4 py-3">{cents && leads ? money.format(cents / 100 / leads) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em] text-[var(--color-muted)]">Por página</h2>
        {byPage.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">Sem dados.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {byPage.map((row) => (
              <li key={row.path} className="flex items-center gap-4 rounded-md border bg-[var(--color-surface)] px-4 py-3 text-sm">
                <span className="font-mono text-xs">{row.path}</span>
                <span className="ml-auto text-[var(--color-muted)]">{row.sessions} sessões</span>
                <span>{row.conversions} conversões</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-[0.14em] text-[var(--color-muted)]">
          Informar gasto de campanha
        </h2>
        <p className="mb-4 text-xs text-[var(--color-muted)]">
          Sem integração com as APIs de anúncio no MVP. Informe o gasto aqui para o painel calcular o custo por lead.
        </p>
        <form action={saveSpendAction} className="grid gap-3 sm:grid-cols-6">
          <input type="hidden" name="tenant" value={tenant.slug} />
          <input
            name="campaign"
            placeholder="utm_campaign"
            required
            className="rounded-md border bg-[var(--color-surface)] px-3 py-2.5 font-mono text-xs outline-none focus:border-[var(--color-accent)] sm:col-span-2"
          />
          <select name="channel" className="rounded-md border bg-[var(--color-surface)] px-3 py-2.5 text-sm">
            <option value="google">Google</option>
            <option value="meta">Meta</option>
            <option value="other">Outro</option>
          </select>
          <input
            name="spend"
            placeholder="Gasto (R$)"
            required
            inputMode="decimal"
            className="rounded-md border bg-[var(--color-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
          />
          <input type="date" name="start" required className="rounded-md border bg-[var(--color-surface)] px-3 py-2.5 text-sm" />
          <button className="rounded-md bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-[var(--color-accent-ink)]">
            Salvar
          </button>
        </form>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--color-surface)] px-5 py-6">
      <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.02em]">{value}</p>
    </div>
  );
}
