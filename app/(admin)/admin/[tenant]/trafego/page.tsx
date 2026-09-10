import { notFound, redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { getTenantBySlug } from '@/lib/tenant-queries';
import {
  defaultPeriod,
  periodSchema,
  trafficReport,
} from '@/lib/admin/traffic';
import { AdminHeader } from '@/components/admin/navigation';
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
  if (!(await isAuthenticated())) redirect('/admin/login');
  const tenant = await getTenantBySlug((await params).tenant);
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
      <AdminHeader tenant={tenant} active="trafego" />
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Tráfego e contatos
            </h1>
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
        <form className="mt-7 flex flex-wrap items-end gap-3">
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
        <TrafficReport data={data} />
        <section className="mt-10 rounded-xl border p-5 sm:p-7">
          <h2 className="text-lg font-semibold">Gastos de campanha</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Adicione cada gasto uma vez, com seu período completo. Os valores de
            todos os canais da campanha são somados.
          </p>
          <SpendForm tenant={tenant.slug} period={period} />
        </section>
      </main>
    </>
  );
}
