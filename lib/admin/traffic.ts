import { z } from 'zod';
import { db } from '@/lib/db';

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T12:00:00Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, 'Confira a data.');
export const periodSchema = z
  .object({ start: date, end: date })
  .refine(
    (range) => range.start <= range.end,
    'O fim precisa ser igual ou posterior ao início.',
  );
export const spendSchema = z
  .object({
    campaign: z.string().trim().min(1).max(160),
    channel: z.enum(['google', 'meta', 'other']),
    spend: z
      .string()
      .regex(
        /^\d+(?:[.,]\d{1,2})?$/,
        'Informe um gasto positivo, com até duas casas decimais.',
      )
      .transform((value) => Math.round(Number(value.replace(',', '.')) * 100))
      .refine(
        (value) =>
          Number.isSafeInteger(value) && value > 0 && value <= 100_000_000,
        'Confira o valor do gasto.',
      ),
    start: date,
    end: date,
  })
  .refine(
    (range) => range.start <= range.end,
    'O fim precisa ser igual ou posterior ao início.',
  );

export function defaultPeriod(now = new Date()) {
  const end = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const start = new Date(`${end}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 29);
  return { start: start.toISOString().slice(0, 10), end };
}

type Counts = { visitors: number; forms: number; whats: number };
type Campaign = Counts & { campaign: string; src: string };
type Spend = { campaign: string; cents: number; partial: number };
export function mergeCampaigns(events: Campaign[], spend: Spend[]) {
  const rows = new Map(
    events.map((row) => [
      row.campaign,
      {
        ...row,
        visitors: Number(row.visitors),
        forms: Number(row.forms),
        whats: Number(row.whats),
        cents: 0,
      },
    ]),
  );
  for (const item of spend) {
    const row = rows.get(item.campaign) ?? {
      campaign: item.campaign,
      src: 'Sem visitas registradas',
      visitors: 0,
      forms: 0,
      whats: 0,
      cents: 0,
    };
    row.cents += Number(item.cents);
    rows.set(item.campaign, row);
  }
  return [...rows.values()].sort(
    (a, b) =>
      b.visitors - a.visitors ||
      b.cents - a.cents ||
      a.campaign.localeCompare(b.campaign),
  );
}

export async function trafficReport(
  tenantId: string,
  period: { start: string; end: string },
) {
  const { start, end } = period;
  const sql = db();
  const [totals, campaigns, pages, spending] = await Promise.all([
    sql`select count(distinct session_id) filter (where type = 'page_view') as visitors,
      count(*) filter (where type = 'form_submit') as forms,
      count(*) filter (where type = 'whatsapp_click') as whats
      from events where tenant_id = ${tenantId}
      and created_at >= (${start}::date::timestamp at time zone 'America/Sao_Paulo')
      and created_at < ((${end}::date + 1)::timestamp at time zone 'America/Sao_Paulo')`,
    sql`select coalesce(nullif(source->>'utm_campaign', ''), '(direto)') as campaign,
      string_agg(distinct coalesce(nullif(source->>'utm_source', ''), '(direto)'), ', ') as src,
      count(distinct session_id) filter (where type = 'page_view') as visitors,
      count(*) filter (where type = 'form_submit') as forms,
      count(*) filter (where type = 'whatsapp_click') as whats
      from events where tenant_id = ${tenantId}
      and created_at >= (${start}::date::timestamp at time zone 'America/Sao_Paulo')
      and created_at < ((${end}::date + 1)::timestamp at time zone 'America/Sao_Paulo') group by 1`,
    sql`select path, count(distinct session_id) filter (where type = 'page_view') as visitors,
      count(*) filter (where type in ('form_submit','whatsapp_click')) as actions
      from events where tenant_id = ${tenantId} and path is not null
      and created_at >= (${start}::date::timestamp at time zone 'America/Sao_Paulo')
      and created_at < ((${end}::date + 1)::timestamp at time zone 'America/Sao_Paulo')
      group by 1 order by visitors desc limit 20`,
    sql`select campaign, coalesce(sum(spend_cents) filter (where period_start >= ${start}::date and period_end <= ${end}::date), 0) as cents,
      count(*) filter (where period_start < ${start}::date or period_end > ${end}::date) as partial
      from campaign_spend where tenant_id = ${tenantId} and period_end >= ${start}::date and period_start <= ${end}::date group by campaign`,
  ]);
  const counts = (totals as Counts[])[0];
  const spends = spending as Spend[];
  const rows = mergeCampaigns(campaigns as Campaign[], spends);
  return {
    period,
    visitors: Number(counts.visitors),
    forms: Number(counts.forms),
    whats: Number(counts.whats),
    cents: spends.reduce((sum, row) => sum + Number(row.cents), 0),
    partialSpends: spends.reduce((sum, row) => sum + Number(row.partial), 0),
    campaignCount: rows.length,
    campaigns: rows.slice(0, 50),
    pages: (pages as { path: string; visitors: number; actions: number }[]).map(
      (row) => ({
        ...row,
        visitors: Number(row.visitors),
        actions: Number(row.actions),
      }),
    ),
  };
}
export type TrafficData = Awaited<ReturnType<typeof trafficReport>>;
