import type { TrafficData } from '@/lib/admin/traffic';
const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
const num = new Intl.NumberFormat('pt-BR');

export function TrafficReport({ data }: { data: TrafficData }) {
  return (
    <>
      <section
        aria-label="Resultados do período"
        className="my-8 grid grid-cols-2 gap-6 rounded-xl border bg-[var(--color-surface)] p-6 lg:grid-cols-4"
      >
        {[
          ['Visitantes identificados', num.format(data.visitors)],
          ['Formulários recebidos', num.format(data.forms)],
          ['Cliques no WhatsApp', num.format(data.whats)],
          ['Gasto informado', money.format(data.cents / 100)],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-[var(--color-muted)]">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
              {value}
            </p>
          </div>
        ))}
      </section>
      <p className="mb-8 max-w-3xl text-xs leading-relaxed text-[var(--color-muted)]">
        Visitantes são identificadores de navegador, não pessoas únicas. Ações
        de contato somam formulários e cliques no WhatsApp; clicar não confirma
        uma conversa. Dados anteriores a esta revisão podem conter cliques
        duplicados.
      </p>
      {data.partialSpends ? (
        <p className="mb-6 rounded-lg border p-4 text-sm text-[var(--color-warn)]">
          {data.partialSpends} lançamentos de gasto cruzam os limites do filtro
          e ficaram fora dos custos. Amplie o período para incluir esses
          lançamentos por inteiro.
        </p>
      ) : null}
      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Por campanha</h2>
          <span className="text-xs text-[var(--color-muted)]">
            {data.campaignCount > 50
              ? '50 principais; totais incluem todas'
              : `${data.campaignCount} campanhas`}
          </span>
        </div>
        {data.campaigns.length ? (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[680px] text-left text-sm">
              <caption className="sr-only">
                Campanhas no período selecionado
              </caption>
              <thead className="border-b bg-[var(--color-surface)] text-xs text-[var(--color-muted)]">
                <tr>
                  {[
                    'Campanha',
                    'Visitantes',
                    'Formulários',
                    'WhatsApp',
                    'Gasto',
                    'Custo por ação',
                  ].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="px-4 py-3 font-medium"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.campaigns.map((row) => (
                  <tr key={row.campaign}>
                    <th scope="row" className="max-w-64 px-4 py-4 font-medium">
                      <span className="block break-words">{row.campaign}</span>
                      <span className="mt-1 block text-xs font-normal text-[var(--color-muted)]">
                        {row.src}
                      </span>
                    </th>
                    <td className="px-4 tabular-nums">
                      {num.format(row.visitors)}
                    </td>
                    <td className="px-4 tabular-nums">
                      {num.format(row.forms)}
                    </td>
                    <td className="px-4 tabular-nums">
                      {num.format(row.whats)}
                    </td>
                    <td className="px-4 tabular-nums">
                      {row.cents ? money.format(row.cents / 100) : '—'}
                    </td>
                    <td className="px-4 tabular-nums">
                      {row.cents && row.forms + row.whats
                        ? money.format(
                            row.cents / 100 / (row.forms + row.whats),
                          )
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed px-5 py-12 text-center text-sm text-[var(--color-muted)]">
            Nenhuma visita ou gasto neste período. Escolha outras datas ou
            acompanhe o site após a publicação.
          </p>
        )}
      </section>
      <section className="mt-9">
        <h2 className="mb-4 text-lg font-semibold">Páginas mais visitadas</h2>
        {data.pages.length ? (
          <ul className="divide-y">
            {data.pages.map((page) => (
              <li
                key={page.path}
                className="flex flex-wrap items-center gap-x-5 gap-y-2 py-4 text-sm"
              >
                <span className="min-w-0 flex-1 break-all">{page.path}</span>
                <span className="text-xs text-[var(--color-muted)]">
                  {num.format(page.visitors)} visitantes
                </span>
                <span className="text-xs">
                  {num.format(page.actions)} ações
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">
            Nenhuma página visitada no período.
          </p>
        )}
      </section>
    </>
  );
}
