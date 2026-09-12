import Link from 'next/link';
import { adminTenant } from '@/lib/admin/queries';
import { notFound, redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import {
  defaultPeriod,
  periodSchema,
  trafficReport,
} from '@/lib/admin/traffic';
import { TrafficReport } from '@/components/admin/traffic-report';
import { SpendForm } from './spend-form';

export const dynamic = 'force-dynamic';
export default async function TrafficPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenant: slug } = await params;
  if (!(await isAuthenticated()))
    redirect(
      `/admin/login?returnTo=${encodeURIComponent(`/admin/${slug}/trafego`)}`,
    );
  const tenant = await adminTenant(slug);
  if (!tenant) notFound();
  const query = await searchParams;
  const parsed = periodSchema.safeParse({
    ...defaultPeriod(),
    ...(query.start ? { start: query.start } : {}),
    ...(query.end ? { end: query.end } : {}),
  });
  const period = parsed.success ? parsed.data : defaultPeriod();
  const data = await trafficReport(tenant.id, period);
  return (
    <>
      <main className="admin-page">
        <div className="admin-page-heading">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Tráfego</h1>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Acompanhe o interesse e os pedidos que chegam pelo site.
            </p>
          </div>
          <a
            className="admin-secondary"
            href={`/api/admin/${tenant.slug}/contatos.csv`}
            title="Últimos 5.000 contatos de todos os períodos"
          >
            Todos os contatos (CSV)
          </a>
        </div>
        <div className="admin-traffic-toolbar">
          <fieldset
            className="admin-segmented"
            aria-label="Período do relatório"
          >
            {[7, 30, 90].map((days) => {
              const preset = defaultPeriod(new Date(), days);
              return (
                <Link
                  key={days}
                  href={`/admin/${tenant.slug}/trafego?start=${preset.start}&end=${preset.end}`}
                  aria-current={
                    period.start === preset.start && period.end === preset.end
                      ? 'page'
                      : undefined
                  }
                >
                  {days} dias
                </Link>
              );
            })}
          </fieldset>
          <a className="admin-secondary" href="#gastos">
            Lançar gasto
          </a>
        </div>
        <form
          key={`${period.start}-${period.end}`}
          className="mt-7 flex flex-wrap items-end gap-3"
        >
          <label className="admin-field">
            <span>De</span>
            <input
              className="admin-input"
              name="start"
              type="date"
              defaultValue={period.start}
              required
            />
          </label>
          <label className="admin-field">
            <span>Até</span>
            <input
              className="admin-input"
              name="end"
              type="date"
              defaultValue={period.end}
              required
            />
          </label>
          <button className="admin-primary" type="submit">
            Aplicar período
          </button>
          <span className="pb-3 text-xs text-[var(--color-muted)]">
            Horário de Brasília
          </span>
        </form>
        {!parsed.success ? (
          <p className="mt-3 text-sm text-[var(--color-warn)]">
            Período inválido. Exibindo os últimos 30 dias.
          </p>
        ) : null}
        <TrafficReport data={data} tenant={tenant.slug} />
        <section id="gastos" className="admin-form-section mt-8">
          <h2 className="text-lg font-semibold">Gastos de campanha</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Adicione cada gasto uma vez, com seu período completo. Os valores de
            todos os canais da campanha são somados.
          </p>
          <SpendForm
            key={`${period.start}-${period.end}`}
            tenant={tenant.slug}
            period={period}
          />
        </section>
      </main>
    </>
  );
}
