import Link from 'next/link';
import type { TrafficData } from '@/lib/admin/traffic';
import { defaultPeriod } from '@/lib/admin/traffic';
import { EmptyState, MetricCard, Notice } from './primitives';
const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
const num = new Intl.NumberFormat('pt-BR');
const dayLabel = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

export function TrafficReport({
  data,
  tenant,
}: {
  data: TrafficData;
  tenant: string;
}) {
  const actions = data.forms + data.whats;
  const max = Math.max(1, ...data.series.map((day) => day.visitors));
  const maxPage = Math.max(1, ...data.pages.map((page) => page.visitors));
  const longer = defaultPeriod(new Date(), 90);
  return (
    <div className="admin-traffic-report">
      <section className="admin-metrics" aria-label="Resultados do período">
        <MetricCard
          label="Visitantes"
          value={num.format(data.visitors)}
          note="Identificadores de navegador"
        />
        <MetricCard
          label="Formulários"
          value={num.format(data.forms)}
          note="Contatos recebidos no período"
        />
        <MetricCard
          label="WhatsApp"
          value={num.format(data.whats)}
          note="Cliques; não confirmam conversa"
        />
        <MetricCard
          label="Investimento"
          value={data.cents ? money.format(data.cents / 100) : 'Não informado'}
          note={
            data.cents && actions
              ? `${money.format(data.cents / 100 / actions)} por ação de contato`
              : 'Gastos lançados pela operação'
          }
        />
      </section>
      <p className="admin-traffic-method">
        Visitantes são identificadores de navegador, não pessoas únicas. Ações
        de contato somam formulários e cliques no WhatsApp; clicar não confirma
        uma conversa. Dados antigos podem conter cliques duplicados.
      </p>
      {data.partialSpends ? (
        <Notice
          tone="warn"
          title={`${data.partialSpends} ${data.partialSpends === 1 ? 'lançamento ficou fora do custo' : 'lançamentos ficaram fora do custo'}`}
        >
          Os gastos cruzam os limites do filtro. Amplie o período para incluir
          cada lançamento por inteiro.
        </Notice>
      ) : null}
      {data.series.some((day) => day.visitors > 0) ? (
        <section className="admin-chart-panel">
          <div className="admin-panel-heading">
            <h2>Visitantes por dia</h2>
            <span>Pico: {num.format(max)}</span>
          </div>
          <div className="admin-chart-legend">
            <span>
              <i data-kind="contacts" />
              com ação de contato
            </span>
            <span>
              <i />
              só visita
            </span>
          </div>
          <svg
            className="admin-traffic-chart"
            viewBox={`0 0 ${Math.max(data.series.length * 16, 112)} 140`}
            preserveAspectRatio="none"

            aria-label={`Visitantes diários de ${dayLabel(data.period.start)} a ${dayLabel(data.period.end)}. Pico de ${max}. Os valores estão na tabela abaixo.`}
          >
            {data.series.map((day, i) => (
              <g key={day.day}>
                <title>
                  {dayLabel(day.day)}: {day.visitors} visitantes, {day.contacts}{' '}
                  com ação de contato
                </title>
                <rect
                  className="admin-chart-visits"
                  x={i * 16 + 2}
                  y={132 - ((day.visitors - day.contacts) / max) * 124}
                  width="12"
                  height={((day.visitors - day.contacts) / max) * 124}
                  rx="2"
                />
                <rect
                  className="admin-chart-contacts"
                  x={i * 16 + 2}
                  y={132 - (day.visitors / max) * 124}
                  width="12"
                  height={(day.contacts / max) * 124}
                  rx="2"
                />
              </g>
            ))}
          </svg>
          <div className="admin-chart-axis">
            <span>{dayLabel(data.period.start)}</span>
            <span>{dayLabel(data.period.end)}</span>
          </div>
          <p className="admin-traffic-method">
            Cada visitante conta uma vez por dia. A faixa âmbar indica quem
            visitou e fez uma ação de contato naquele dia.
          </p>
          <details className="admin-chart-table">
            <summary>Ver valores por dia</summary>
            <table>
              <thead>
                <tr>
                  <th scope="col">Dia</th>
                  <th scope="col">Visitantes</th>
                  <th scope="col">Com ação de contato</th>
                </tr>
              </thead>
              <tbody>
                {data.series.map((day) => (
                  <tr key={day.day}>
                    <th scope="row">{dayLabel(day.day)}</th>
                    <td>{day.visitors}</td>
                    <td>{day.contacts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>
      ) : (
        <EmptyState
          kind="traffic"
          title="Nenhuma visita neste período"
          action={
            <Link
              className="admin-secondary"
              href={`/admin/${tenant}/trafego?start=${longer.start}&end=${longer.end}`}
            >
              Ver 90 dias
            </Link>
          }
        >
          Amplie o período ou confira se o site está publicado e se as campanhas
          apontam para o endereço correto.
        </EmptyState>
      )}
      <div className="admin-traffic-columns">
        <section className="admin-traffic-panel">
          <div className="admin-panel-heading">
            <h2>Campanhas</h2>
            <span>
              {data.campaignCount > 50
                ? '50 principais; totais incluem todas'
                : `${data.campaignCount} campanhas`}
            </span>
          </div>
          {data.campaigns.length ? (
            <section
              className="admin-campaign-scroll"
              aria-label="Campanhas no período"
            >
              <table className="admin-campaign-table">
                <thead>
                  <tr>
                    <th scope="col">Campanha</th>
                    <th scope="col">Visitas</th>
                    <th scope="col">Ações</th>
                    <th scope="col">Gasto</th>
                  </tr>
                </thead>
                <tbody>
                  {data.campaigns.map((row) => (
                    <tr key={row.campaign}>
                      <th scope="row">
                        <span>{row.campaign}</span>
                        <small>{row.src}</small>
                      </th>
                      <td>{num.format(row.visitors)}</td>
                      <td>
                        <span className="admin-contact-value">
                          {num.format(row.forms + row.whats)}
                        </span>
                        <small>
                          {row.forms} form. · {row.whats} WhatsApp
                        </small>
                      </td>
                      <td>
                        {row.cents ? (
                          money.format(row.cents / 100)
                        ) : (
                          <small>Não informado</small>
                        )}
                        {row.cents && row.forms + row.whats ? (
                          <small>
                            {money.format(
                              row.cents / 100 / (row.forms + row.whats),
                            )}
                            /ação
                          </small>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : (
            <p className="admin-panel-empty">
              Nenhuma campanha com visita ou gasto no período.
            </p>
          )}
        </section>
        <section className="admin-traffic-panel">
          <div className="admin-panel-heading">
            <h2>Páginas</h2>
            <span>20 mais visitadas</span>
          </div>
          {data.pages.length ? (
            <ul className="admin-page-stats">
              {data.pages.map((page) => (
                <li key={page.path}>
                  <div>
                    <span>{page.path}</span>
                    <strong>{num.format(page.visitors)}</strong>
                    <small>↳ {num.format(page.actions)} ações</small>
                  </div>
                  <meter
                    min="0"
                    max={maxPage}
                    value={page.visitors}
                    aria-label={`${page.path}: ${page.visitors} visitantes`}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-panel-empty">
              Nenhuma página visitada neste período.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
