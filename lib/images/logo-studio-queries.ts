import { db } from '@/lib/db';
import { randomUUID } from 'node:crypto';
import type { Brand, LogoStudioState } from '@/lib/types';

export async function ensureLogoRevision(
  tenantId: string,
  source: string,
): Promise<Brand | null> {
  const rows =
    (await db()`update tenants set brand = brand || jsonb_build_object('logoRevision',
    coalesce(nullif(brand->>'logoRevision', ''), ${randomUUID()}::text))
    where id = ${tenantId} and brand->>'logoUrl' = ${source} returning brand`) as {
      brand: Brand;
    }[];
  return (rows[0]?.brand as Brand) ?? null;
}

export async function claimLogoStudio(
  tenantId: string,
  source: string,
  state: LogoStudioState,
): Promise<boolean> {
  const staleBefore = new Date(
    new Date(state.startedAt).getTime() - 15 * 60_000,
  ).toISOString();
  const rows =
    (await db()`update tenants set brief = coalesce(brief, '{}'::jsonb) || ${JSON.stringify({ logoStudio: state })}::jsonb
    where id = ${tenantId} and brand->>'logoUrl' = ${source} and (
      coalesce(brief #>> '{logoStudio,sourceHash}', '') <> ${state.sourceHash}
      or brief #>> '{logoStudio,status}' = 'failed'
      or (brief #>> '{logoStudio,status}' = 'running' and coalesce(brief #>> '{logoStudio,startedAt}', '') < ${staleBefore})
    ) returning id`) as { id: string }[];
  return rows.length > 0;
}

export async function finishLogoStudio(
  tenantId: string,
  state: LogoStudioState,
): Promise<boolean> {
  const rows =
    (await db()`update tenants set brief = coalesce(brief, '{}'::jsonb) || ${JSON.stringify({ logoStudio: state })}::jsonb
    where id = ${tenantId} and brief #>> '{logoStudio,sourceHash}' = ${state.sourceHash}
      and brief #>> '{logoStudio,startedAt}' = ${state.startedAt} returning id`) as {
      id: string;
    }[];
  return rows.length > 0;
}

export async function persistLogoReceipt(
  tenantId: string,
  text: string,
): Promise<void> {
  await db()`insert into chat_messages (tenant_id, role, content, channel) values (${tenantId}, 'assistant', ${text}, 'site')`;
}
