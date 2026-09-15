import Link from 'next/link';
import type {
  UsageFilters,
  UsageHistory,
  UsageNumbers,
} from '@/lib/admin/usage-history';
import { USAGE_LABELS } from '@/lib/admin/usage-history';
import { defaultPeriod } from '@/lib/admin/traffic';
import { formatCount } from '@/lib/admin/usage-summary';

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 6,
});
const date = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

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
          {value === null ? '' : 'Parcial · '}
          {formatCount(missing)} sem informação
        </small>
      ) : null}
    </>
  );
}

function Totals({ totals }: { totals: UsageNumbers }) {
  return (
    <dl className="admin-consumption-totals">
      <div>
        <dt>Tokens de entrada</dt>
        <dd>
          <Metric value={totals.inputTokens} missing={totals.missingInput} />
        </dd>
      </div>
      <div>
        <dt>Tokens de saída</dt>
        <dd>
          <Metric value={totals.outputTokens} missing={totals.missingOutput} />
        </dd>
      </div>
      <div>
        <dt>Total de tokens</dt>
        <dd>
          <Metric value={totals.totalTokens} missing={totals.missingTotal} />
        </dd>
      </div>
      <div>
        <dt>Custo informado · USD</dt>
        <dd>
          <Metric
            value={totals.costUsd}
            missing={totals.missingCost}
            currency
          />
        </dd>
      </div>
    </dl>
  );
}

export function UsageHistoryPanel({
  data,
  filters,
  slug,
}: {
  data: UsageHistory;
  filters: UsageFilters;
  slug: string;
}) {
  const base = `/admin/${encodeURIComponent(slug)}/dados`;
  const url = (period: { start?: string; end?: string }, page = 1) => {
    const query = new URLSearchParams(
      period.start && period.end
        ? { start: period.start, end: period.end }
        : { period: 'all' },
    );
    if (page > 1) query.set('usagePage', String(page));
    return `${base}?${query}#consumo`;
  };

  return (
    <section
      id="consumo"
      className="admin-consumption"
      aria-labelledby="consumption-heading"
    >
      <div className="admin-page-heading">
        <div>
          <h2 id="consumption-heading">Consumo de IA</h2>
          <p>
            Histórico deste cliente, por conversa, geração e chamada de apoio.
          </p>
        </div>
        <Link className="admin-secondary" href={url(filters, data.page)}>
          Atualizar histórico
        </Link>
      </div>

      <nav
        className="admin-consumption-presets"
        aria-label="Período do consumo"
      >
        {[7, 30, 90].map((days) => {
          const period = defaultPeriod(new Date(), days);
          return (
            <Link
              key={days}
              className="admin-secondary"
              href={url(period)}
              aria-current={
                filters.start === period.start && filters.end === period.end
                  ? 'page'
                  : undefined
              }
            >
              {days} dias
            </Link>
          );
        })}
        <Link
          className="admin-secondary"
          href={url({})}
          aria-current={!filters.start ? 'page' : undefined}
        >
          Todo o histórico
        </Link>
      </nav>

      <form action={`${base}#consumo`} className="admin-consumption-filter">
        <label className="admin-field">
          <span>De</span>
          <input
            className="admin-input"
            type="date"
            name="start"
            defaultValue={filters.start ?? ''}
            required
          />
        </label>
        <label className="admin-field">
          <span>Até</span>
          <input
            className="admin-input"
            type="date"
            name="end"
            defaultValue={filters.end ?? ''}
            required
          />
        </label>
        <button className="admin-primary" type="submit">
          Aplicar período
        </button>
        <span>Horário de Brasília</span>
      </form>

      {filters.error ? <p role="alert">{filters.error}</p> : null}
      {!data.totals.calls ? (
        <p className="admin-consumption-empty">
          Nenhum consumo registrado neste período. O histórico aparecerá
          conforme o cliente usar a IA.
        </p>
      ) : (
        <>
          <Totals totals={data.totals} />
          <p className="admin-consumption-note">
            {formatCount(data.totalRows)} operações ·{' '}
            {formatCount(data.totals.calls)} registros de chamadas
            {data.totals.pending
              ? ` · ${formatCount(data.totals.pending)} aguardando recibo ou interrompidos`
              : ''}
            {data.totals.failed
              ? ` · ${formatCount(data.totals.failed)} com falha`
              : ''}
            .
          </p>

          <div className="admin-consumption-list">
            {data.rows.map((row) => (
              <article
                key={`${row.operationId}-${row.model}`}
                className="admin-consumption-row"
              >
                <div className="admin-consumption-operation">
                  <h3>{USAGE_LABELS[row.kind] ?? row.kind}</h3>
                  <time dateTime={row.createdAt}>
                    {date.format(new Date(row.createdAt))}
                  </time>
                  <span>
                    {row.model}
                    {row.phase ? ` · ${row.phase}` : ''}
                  </span>
                  <span>
                    {row.legacy
                      ? 'Recibo antigo de etapa'
                      : `${row.calls} chamada${row.calls === 1 ? '' : 's'}`}
                    {row.pending ? ' · Sem recibo final' : ''}
                    {row.failed ? ' · Falha' : ''}
                  </span>
                </div>
                <dl className="admin-consumption-values">
                  <div>
                    <dt>Entrada</dt>
                    <dd>
                      <Metric
                        value={row.inputTokens}
                        missing={row.missingInput}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt>Saída</dt>
                    <dd>
                      <Metric
                        value={row.outputTokens}
                        missing={row.missingOutput}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt>Total</dt>
                    <dd>
                      <Metric
                        value={row.totalTokens}
                        missing={row.missingTotal}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt>Custo · USD</dt>
                    <dd>
                      <Metric
                        value={row.costUsd}
                        missing={row.missingCost}
                        currency
                      />
                    </dd>
                  </div>
                </dl>
                <details className="admin-consumption-details">
                  <summary>Detalhes da operação</summary>
                  <dl>
                    <div>
                      <dt>Tokens de entrada lidos do cache</dt>
                      <dd>
                        <Metric
                          value={row.cacheReadTokens}
                          missing={row.missingCache}
                        />
                      </dd>
                    </div>
                    <div>
                      <dt>Tokens gravados no cache</dt>
                      <dd>
                        <Metric
                          value={row.cacheWriteTokens}
                          missing={row.missingCacheWrite}
                        />
                      </dd>
                    </div>
                    <div>
                      <dt>Tokens de raciocínio na saída</dt>
                      <dd>
                        <Metric
                          value={row.reasoningTokens}
                          missing={row.missingReasoning}
                        />
                      </dd>
                    </div>
                    <div>
                      <dt>Identificador da operação</dt>
                      <dd>{row.operationId}</dd>
                    </div>
                    {row.runId ? (
                      <div>
                        <dt>Identificador da geração</dt>
                        <dd>{row.runId}</dd>
                      </div>
                    ) : null}
                  </dl>
                </details>
              </article>
            ))}
          </div>

          <nav
            className="admin-consumption-pagination"
            aria-label="Páginas do histórico"
          >
            {data.page > 1 ? (
              <Link
                className="admin-secondary"
                href={url(filters, data.page - 1)}
              >
                Anterior
              </Link>
            ) : null}
            <span>
              Página {data.page} de {data.pages}
            </span>
            {data.page < data.pages ? (
              <Link
                className="admin-secondary"
                href={url(filters, data.page + 1)}
              >
                Próxima
              </Link>
            ) : null}
          </nav>

          <details className="admin-consumption-daily">
            <summary>Totais por dia</summary>
            <section
              className="admin-consumption-table"
              aria-label="Consumo diário"
            >
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
            </section>
          </details>
        </>
      )}

      <p className="admin-consumption-note">
        Valores informados pelo provedor, em dólar, sem conversão para reais.
        Cache e raciocínio já fazem parte da entrada e saída; não são somados
        novamente. Ausências deixam os totais parciais. Imagens podem ter custo
        sem contagem de tokens.
      </p>
      <p className="admin-consumption-note">
        O histórico antigo recupera apenas recibos de geração que foram salvos.
        Conversas e chamadas de apoio anteriores ao registro persistente não
        podem ser reconstruídas. Tentativas do provedor sem recibo e
        interrupções podem ter consumo não informado; estes números não
        substituem a fatura.
        {data.firstRecordedAt
          ? ` Primeiro registro disponível: ${date.format(new Date(data.firstRecordedAt))}.`
          : ''}
      </p>
    </section>
  );
}
