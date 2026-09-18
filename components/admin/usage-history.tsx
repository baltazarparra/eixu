import Link from 'next/link';
import { ArrowLeft, ChevronDown, RefreshCw } from 'lucide-react';
import type {
  UsageFilters,
  UsageHistory,
  UsageNumbers,
  UsageOperationTotals,
} from '@/lib/admin/usage-history';
import {
  SOURCE_LABELS,
  LIFECYCLE_LABELS,
  USAGE_PERIODS,
  USAGE_PERIOD_LABELS,
  phaseLabel,
  usageLabel,
} from '@/lib/admin/usage-history';
import { formatCount } from '@/lib/admin/usage-summary';

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 6,
});
const headline = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const rowMoney = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});
const perMillion = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});
const date = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});
const fullDate = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Ausência é declarada; parcial continua dizendo quanto falta. */
function Metric({
  value,
  missing,
  currency = false,
}: {
  value: number | null;
  missing: number;
  currency?: boolean;
}) {
  return (
    <>
      <span>
        {value === null
          ? 'Não informado'
          : currency
            ? money.format(value)
            : formatCount(value)}
      </span>
      {missing > 0 ? (
        <small>
          {' '}
          {value === null ? '' : 'Parcial · '}
          {formatCount(missing)} sem informação
        </small>
      ) : null}
    </>
  );
}

function callsText(row: UsageNumbers & { legacy: number }) {
  return [
    row.legacy
      ? 'Recibo antigo de etapa'
      : `${row.calls} chamada${row.calls === 1 ? '' : 's'}`,
    row.pending ? 'Sem recibo final' : '',
    row.failed ? 'Falha' : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Custo vira manchete; entrada, saída e total ficam na mesma faixa. */
function Totals({ totals }: { totals: UsageNumbers }) {
  const rate =
    totals.costUsd !== null &&
    totals.totalTokens &&
    !totals.missingCost &&
    !totals.missingTotal
      ? (totals.costUsd / totals.totalTokens) * 1_000_000
      : null;
  return (
    <section className="admin-consumo-totals" aria-label="Totais do período">
      <div className="admin-consumo-headline">
        <p className="admin-label">Custo informado no período</p>
        {totals.costUsd === null ? (
          <p className="admin-consumo-absent">Não informado</p>
        ) : (
          <p className="admin-consumo-amount">
            <span>US$</span>
            <strong>{headline.format(totals.costUsd)}</strong>
          </p>
        )}
        <p className="admin-consumo-exact">
          {totals.costUsd === null
            ? `${formatCount(totals.missingCost)} operações sem custo informado`
            : `exato: ${money.format(totals.costUsd)}${
                rate === null
                  ? ''
                  : ` · ≈ ${perMillion.format(rate)} por milhão de tokens`
              }`}
          {totals.costUsd !== null && totals.missingCost > 0
            ? ` · parcial, ${formatCount(totals.missingCost)} sem informação`
            : ''}
        </p>
      </div>
      <dl className="admin-consumo-breakdown">
        <div>
          <dt>Entrada</dt>
          <dd>
            <Metric value={totals.inputTokens} missing={totals.missingInput} />
          </dd>
        </div>
        <div>
          <dt>Saída</dt>
          <dd>
            <Metric
              value={totals.outputTokens}
              missing={totals.missingOutput}
            />
          </dd>
        </div>
        <div data-total="">
          <dt>Total</dt>
          <dd>
            <Metric value={totals.totalTokens} missing={totals.missingTotal} />
          </dd>
        </div>
      </dl>
    </section>
  );
}

/**
 * Barra por etapa, não por dia: o operador procura a operação cara, e a
 * pergunta "qual etapa gastou isso" é a que o gráfico responde.
 */
function ByOperation({ rows }: { rows: UsageOperationTotals[] }) {
  const drawable = rows.filter((row) => (row.totalTokens ?? 0) > 0);
  if (drawable.length < 2) return null;
  const largest = Math.max(...drawable.map((row) => row.totalTokens ?? 0));
  return (
    <section className="admin-consumo-chart" aria-label="Consumo por operação">
      <div className="admin-consumo-chart-head">
        <h2>Por operação</h2>
        <p>
          <span>
            <i data-part="entrada" />
            entrada
          </span>
          <span>
            <i data-part="saida" />
            saída
          </span>
        </p>
      </div>
      <div className="admin-consumo-bars">
        {drawable.map((row) => (
          <div key={`${row.kind}-${row.phase ?? ''}`}>
            <span>{phaseLabel(row.phase) ?? usageLabel(row.kind, null)}</span>
            <span className="admin-consumo-bar">
              <span
                data-part="entrada"
                style={{
                  width: `${((row.inputTokens ?? 0) / largest) * 100}%`,
                }}
              />
              <span
                data-part="saida"
                style={{
                  width: `${((row.outputTokens ?? 0) / largest) * 100}%`,
                }}
              />
            </span>
            <span className="admin-numeric">
              {formatCount(row.totalTokens ?? undefined)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function UsageHistoryPanel({
  data,
  filters,
  slug,
  name,
}: {
  data: UsageHistory;
  filters: UsageFilters;
  slug: string;
  name: string;
}) {
  const base = `/admin/${encodeURIComponent(slug)}/consumo`;
  const url = (periodo: UsageFilters['periodo'], page = 1) => {
    const query = new URLSearchParams();
    if (periodo === 'livre') {
      if (filters.start) query.set('start', filters.start);
      if (filters.end) query.set('end', filters.end);
    } else query.set('periodo', periodo);
    if (page > 1) query.set('usagePage', String(page));
    return `${base}?${query}`;
  };

  return (
    <>
      <div className="admin-page-heading admin-consumo-heading">
        <div>
          <p className="admin-eyebrow">{name}</p>
          <h1>Consumo do projeto</h1>
        </div>
        <nav className="admin-consumo-periods" aria-label="Período">
          {USAGE_PERIODS.map((periodo) => (
            <Link
              key={periodo}
              href={url(periodo)}
              aria-current={filters.periodo === periodo ? 'page' : undefined}
            >
              {USAGE_PERIOD_LABELS[periodo]}
            </Link>
          ))}
        </nav>
      </div>

      {data.lifetime ? (
        <section
          className="admin-consumo-caveats"
          aria-label="Acumulado do projeto"
        >
          <p>
            <strong>Acumulado de todo o projeto</strong> ·{' '}
            <Metric
              value={data.lifetime.costUsd}
              missing={data.lifetime.missingCost}
              currency
            />
            {' · '}
            <Metric
              value={data.lifetime.totalTokens}
              missing={data.lifetime.missingTotal}
            />{' '}
            tokens
          </p>
          <p>
            Inclui todos os recibos disponíveis deste cliente, independentemente
            do período abaixo.
          </p>
        </section>
      ) : null}

      {filters.error ? (
        <p className="admin-consumo-alert" role="alert">
          {filters.error}
        </p>
      ) : null}

      {!data.totals.calls ? (
        <p className="admin-consumo-empty">
          Nenhum consumo registrado neste período. O histórico aparecerá
          conforme os recibos do projeto forem registrados.
        </p>
      ) : (
        <>
          <Totals totals={data.totals} />
          <ByOperation rows={data.byOperation} />
          {data.bySource?.length ? (
            <section
              className="admin-consumo-list"
              aria-label="Origem e fase do consumo"
            >
              <div className="admin-consumo-list-head">
                <h2>Origem e fase no período</h2>
              </div>
              <div className="admin-consumo-table">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Origem</th>
                      <th scope="col">Fase</th>
                      <th scope="col">Tokens</th>
                      <th scope="col">Custo · USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bySource.map((item) => (
                      <tr key={`${item.source}:${item.lifecycle}`}>
                        <th scope="row">
                          {SOURCE_LABELS[item.source] ?? item.source}
                        </th>
                        <td>
                          {LIFECYCLE_LABELS[item.lifecycle] ?? item.lifecycle}
                        </td>
                        <td>
                          <Metric
                            value={item.totalTokens}
                            missing={item.missingTotal}
                          />
                        </td>
                        <td>
                          <Metric
                            value={item.costUsd}
                            missing={item.missingCost}
                            currency
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section
            className="admin-consumo-list"
            aria-label="Operações do período"
          >
            <div className="admin-consumo-list-head">
              <h2>Operações</h2>
              <p>
                {formatCount(data.totalRows)} operações ·{' '}
                {formatCount(data.totals.calls)} registros de chamadas
                {data.totals.pending
                  ? ` · ${formatCount(data.totals.pending)} aguardando recibo`
                  : ''}
                {data.totals.failed
                  ? ` · ${formatCount(data.totals.failed)} com falha`
                  : ''}{' '}
                · horário de Brasília
              </p>
            </div>
            <div className="admin-consumo-columns" aria-hidden="true">
              <span>Operação</span>
              <span>Entrada</span>
              <span>Saída</span>
              <span>Custo</span>
              <span />
            </div>
            {data.rows.map((row) => (
              <details
                key={`${row.operationId}-${row.model}`}
                className="admin-consumo-operation"
              >
                <summary>
                  <span className="admin-consumo-operation-name">
                    <span>{usageLabel(row.kind, row.phase)}</span>
                    <small>
                      {date.format(new Date(row.createdAt))} · {row.model}
                    </small>
                  </span>
                  <span className="admin-numeric">
                    <Metric
                      value={row.inputTokens}
                      missing={row.missingInput}
                    />
                  </span>
                  <span className="admin-numeric">
                    <Metric
                      value={row.outputTokens}
                      missing={row.missingOutput}
                    />
                  </span>
                  <span className="admin-numeric">
                    {row.costUsd === null
                      ? 'Não informado'
                      : rowMoney.format(row.costUsd)}
                  </span>
                  <ChevronDown size={14} aria-hidden="true" />
                </summary>
                <dl>
                  <div>
                    <dt>Origem / fase</dt>
                    <dd>
                      {SOURCE_LABELS[row.source] ?? row.source ?? 'EIXU Studio'}{' '}
                      ·{' '}
                      {LIFECYCLE_LABELS[row.lifecycle] ?? 'Fase não registrada'}
                    </dd>
                  </div>
                  <div data-narrow="">
                    <dt>Entrada</dt>
                    <dd>
                      <Metric
                        value={row.inputTokens}
                        missing={row.missingInput}
                      />
                    </dd>
                  </div>
                  <div data-narrow="">
                    <dt>Saída</dt>
                    <dd>
                      <Metric
                        value={row.outputTokens}
                        missing={row.missingOutput}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt>Cache lido</dt>
                    <dd>
                      <Metric
                        value={row.cacheReadTokens}
                        missing={row.missingCache}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt>Cache gravado</dt>
                    <dd>
                      <Metric
                        value={row.cacheWriteTokens}
                        missing={row.missingCacheWrite}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt>Raciocínio na saída</dt>
                    <dd>
                      <Metric
                        value={row.reasoningTokens}
                        missing={row.missingReasoning}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt>Custo exato · USD</dt>
                    <dd>
                      <Metric
                        value={row.costUsd}
                        missing={row.missingCost}
                        currency
                      />
                    </dd>
                  </div>
                  <div>
                    <dt>Chamadas</dt>
                    <dd>{callsText(row)}</dd>
                  </div>
                  <div>
                    <dt>Identificador da operação</dt>
                    <dd data-id="">{row.operationId}</dd>
                  </div>
                  {row.runId ? (
                    <div>
                      <dt>Identificador da geração</dt>
                      <dd data-id="">{row.runId}</dd>
                    </div>
                  ) : null}
                </dl>
              </details>
            ))}
            <div className="admin-consumo-list-foot">
              <span>
                Página {data.page} de {data.pages}
              </span>
              <span className="admin-consumo-pager">
                {data.page > 1 ? (
                  <Link
                    className="admin-compact-button"
                    href={url(filters.periodo, data.page - 1)}
                  >
                    Anterior
                  </Link>
                ) : null}
                {data.page < data.pages ? (
                  <Link
                    className="admin-compact-button"
                    href={url(filters.periodo, data.page + 1)}
                  >
                    Próxima
                  </Link>
                ) : null}
                <Link
                  className="admin-compact-button"
                  href={url(filters.periodo, data.page)}
                >
                  <RefreshCw size={13} aria-hidden="true" />
                  Atualizar histórico
                </Link>
              </span>
            </div>
          </section>
        </>
      )}

      <div className="admin-consumo-caveats">
        <p>
          O total cobre somente recibos recebidos. Codex, Claude, subagentes e
          serviços externos precisam de coleta vinculada a este projeto.
          Ausência de recibos não significa custo zero.
        </p>
        <details>
          <summary>Como estes números são apurados</summary>
          <p>
            Valores informados pelo provedor, em dólar, sem conversão para
            reais. Cache e raciocínio já fazem parte da entrada e da saída; não
            são somados novamente. Ausências deixam os totais parciais. Imagens
            podem ter custo sem contagem de tokens. Estes números não substituem
            a fatura. Assinaturas não têm custo por interação presumido.
            Serviços sem tokens podem ter apenas valor monetário; hospedagem,
            domínio e outras despesas só entram quando existe um recibo
            exclusivo do projeto em USD. Não há rateio automático de faturas
            compartilhadas.
          </p>
        </details>
        <details>
          <summary>Limites do histórico antigo</summary>
          <p>
            Só recibos de geração salvos são recuperados. Conversas e chamadas
            de apoio anteriores ao registro persistente não podem ser
            reconstruídas; tentativas sem recibo e interrupções podem ter
            consumo não informado.
            {data.firstRecordedAt
              ? ` Primeiro registro disponível: ${fullDate.format(new Date(data.firstRecordedAt))}.`
              : ''}
          </p>
        </details>
        {data.daily.length ? (
          <details className="admin-consumo-daily">
            <summary>Totais por dia</summary>
            <div className="admin-consumo-table">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Dia</th>
                    <th scope="col">Entrada</th>
                    <th scope="col">Saída</th>
                    <th scope="col">Total</th>
                    <th scope="col">Custo · USD</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.map((day) => (
                    <tr key={day.day}>
                      <th scope="row">
                        {day.day.split('-').reverse().join('/')}
                      </th>
                      <td>
                        <Metric
                          value={day.inputTokens}
                          missing={day.missingInput}
                        />
                      </td>
                      <td>
                        <Metric
                          value={day.outputTokens}
                          missing={day.missingOutput}
                        />
                      </td>
                      <td>
                        <Metric
                          value={day.totalTokens}
                          missing={day.missingTotal}
                        />
                      </td>
                      <td>
                        <Metric
                          value={day.costUsd}
                          missing={day.missingCost}
                          currency
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ) : null}
      </div>

      <p className="admin-consumo-back">
        <Link className="admin-compact-button" href={`/admin/${slug}/dados`}>
          <ArrowLeft size={13} aria-hidden="true" />
          Voltar ao cadastro
        </Link>
      </p>
    </>
  );
}
