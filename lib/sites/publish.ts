import { db } from '@/lib/db';
import { isDesignProfile } from '@/lib/design/profile';
import {
  compositionConflict,
  compositionConflictMessage,
} from '@/lib/design/uniqueness';
import { listImages } from '@/lib/images/queries';
import { formatFindings, lintPage } from '@/lib/taste/lint';
import { lintSite, publicationState } from '@/lib/taste/site';
import { listPages } from '@/lib/tenant-queries';
import { tenantDraftSnapshot } from '@/lib/sites/snapshot';
import type { Tenant } from '@/lib/types';

export type PublishResult = {
  published: string[];
  /** Uma entrada por página recusada, com os motivos do pre-flight. */
  blocked: { page: string; preflight: string }[];
  url: string;
};

/** API e agente publicam pelo mesmo gate e pela mesma transação. */
export async function publishSite(
  tenant: Tenant,
  slug?: string,
): Promise<PublishResult> {
  const [pages, images] = await Promise.all([
    listPages(tenant.id),
    listImages(tenant.id),
  ]);
  const clean = slug?.replace(/^\/+|\/+$/g, '');
  const targets =
    clean === undefined ? pages : pages.filter((p) => p.slug === clean);
  // Motivos agrupados por página: o painel repetia "/" para cada regra e não
  // dizia qual era o problema.
  const reasons = new Map<string, string[]>();
  const block = (page: string, preflight: string) =>
    reasons.set(page, [...(reasons.get(page) ?? []), preflight]);
  if (!targets.length)
    block(`/${clean ?? ''}`, 'Nenhuma página encontrada para publicar.');
  const ids = new Set(targets.map((p) => p.id));
  // Uma publicação pontual não pode contar rascunhos ainda fora do ar.
  const live = publicationState(pages, ids);
  for (const page of targets) {
    const errors = lintPage(page, tenant.brand.design).filter(
      (f) => f.level === 'error',
    );
    if (errors.length) block(`/${page.slug}`, formatFindings(errors));
  }
  // Só erro recusa o lote, como no pre-flight do painel. Avisos do contrato
  // (proporção, ritmo tonal, silhueta) orientam a revisão e ficam à vista;
  // tratá-los como bloqueio deixava o botão Publicar habilitado e a
  // publicação recusada.
  for (const finding of lintSite(live, images, 'publish', tenant.brand))
    if (finding.level === 'error')
      block(finding.page, formatFindings([finding]));
  const home = live.find((p) => p.slug === '');
  if (home && isDesignProfile(tenant.brand.design)) {
    const conflict = await compositionConflict(
      tenant.id,
      home.blocks,
      tenant.brand.design,
    );
    if (conflict)
      block(
        '/',
        `ERRO [composicao-duplicada] ${compositionConflictMessage(conflict)}`,
      );
  }
  const url = `https://${tenant.slug}.eixu.com.br`;
  const blocked = [...reasons].map(([page, lines]) => ({
    page,
    preflight: lines.join('\n'),
  }));
  if (blocked.length) return { published: [], blocked, url };
  const sql = db();
  const updateTenant =
    clean === undefined || !tenant.publishedSnapshot
      ? sql`update tenants set status = 'published', published_snapshot = ${JSON.stringify(
          tenantDraftSnapshot(tenant),
        )}::jsonb, updated_at = now() where id = ${tenant.id}`
      : sql`update tenants set status = 'published', updated_at = now() where id = ${tenant.id}`;
  // Publica exatamente os valores validados, mesmo se um rascunho mudar durante a consulta.
  await sql.transaction([
    ...targets.map(
      (page) =>
        sql`update pages set published_blocks = ${JSON.stringify(page.blocks)}::jsonb,
                             published_seo = ${JSON.stringify(page.seo)}::jsonb,
                             published_title = ${page.title},
                             published_type = ${page.type},
                             published_meta = ${JSON.stringify(page.meta)}::jsonb,
                             published_nav_order = ${page.navOrder},
                             published_at = now(), updated_at = now()
            where id = ${page.id} and tenant_id = ${tenant.id}`,
    ),
    updateTenant,
  ]);
  return { published: targets.map((p) => `/${p.slug}`), blocked, url };
}
