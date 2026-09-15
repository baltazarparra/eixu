import { db } from '@/lib/db';
import { isDesignProfile } from '@/lib/design/profile';
import {
  compositionConflict,
  compositionConflictMessage,
} from '@/lib/design/uniqueness';
import { listImages } from '@/lib/images/queries';
import { formatFindings, lintPage } from '@/lib/taste/lint';
import { lintSite, publicationState, type SiteFinding } from '@/lib/taste/site';
import { publicationFinding } from '@/lib/sites/publication-policy';
import { listPages } from '@/lib/tenant-queries';
import { publicTenant, tenantDraftSnapshot } from '@/lib/sites/snapshot';
import type { Tenant } from '@/lib/types';

export type PublishResult = {
  published: string[];
  /** Uma entrada por página recusada, com os motivos do pre-flight. */
  blocked: { page: string; preflight: string }[];
  /** Recomendações preservadas; publicar não as transforma em fatos confirmados. */
  warnings?: SiteFinding[];
  url: string;
};

/** API e agente publicam pelo mesmo gate e pela mesma transação. */
export async function publishSite(
  tenant: Tenant,
  slug?: string,
): Promise<PublishResult> {
  const url = `https://${tenant.slug}.eixu.com.br`;
  if (tenant.status === 'archived')
    return {
      published: [],
      blocked: [
        {
          page: '/',
          preflight:
            'O site está arquivado. Reative-o na lista de clientes antes de publicar.',
        },
      ],
      url,
    };
  const [pages, images] = await Promise.all([
    listPages(tenant.id),
    listImages(tenant.id),
  ]);
  const clean = slug?.replace(/^\/+|\/+$/g, '');
  const promotesTenant = clean === undefined || !tenant.publishedSnapshot;
  // O pre-flight usa a mesma apresentação que esta transação colocará no ar.
  const publishedBrand = promotesTenant
    ? tenant.brand
    : publicTenant(tenant).brand;
  const targets =
    clean === undefined ? pages : pages.filter((p) => p.slug === clean);
  // Motivos agrupados por página: o painel repetia "/" para cada regra e não
  // dizia qual era o problema.
  const reasons = new Map<string, string[]>();
  const warnings: SiteFinding[] = [];
  const block = (page: string, preflight: string) =>
    reasons.set(page, [...(reasons.get(page) ?? []), preflight]);
  if (!targets.length)
    block(`/${clean ?? ''}`, 'Nenhuma página encontrada para publicar.');
  const ids = new Set(targets.map((p) => p.id));
  // Uma publicação pontual não pode contar rascunhos ainda fora do ar.
  const live = publicationState(pages, ids);
  for (const page of targets) {
    const findings = lintPage(page, publishedBrand.design).map(
      publicationFinding,
    );
    const errors = findings.filter((f) => f.level === 'error');
    warnings.push(
      ...findings
        .filter((f) => f.level === 'warn')
        .map((f) => ({ ...f, page: `/${page.slug}` })),
    );
    if (errors.length) block(`/${page.slug}`, formatFindings(errors));
  }
  // Só erro recusa o lote, como no pre-flight do painel. Avisos do contrato
  // (proporção, ritmo tonal, silhueta) orientam a revisão e ficam à vista;
  // tratá-los como bloqueio deixava o botão Publicar habilitado e a
  // publicação recusada.
  for (const finding of lintSite(
    live,
    images,
    'publish',
    publishedBrand,
    tenant.brief,
  ).map(publicationFinding))
    if (finding.level === 'error')
      block(finding.page, formatFindings([finding]));
    else warnings.push(finding);
  const home = live.find((p) => p.slug === '');
  if (home && isDesignProfile(publishedBrand.design)) {
    const conflict = await compositionConflict(
      tenant.id,
      home.blocks,
      publishedBrand.design,
    );
    if (conflict)
      warnings.push({
        page: '/',
        level: 'warn',
        rule: 'composicao-duplicada',
        message: compositionConflictMessage(conflict),
      });
  }
  const blocked = [...reasons].map(([page, lines]) => ({
    page,
    preflight: lines.join('\n'),
  }));
  if (blocked.length) return { published: [], blocked, warnings, url };
  const sql = db();
  const updateTenant = promotesTenant
    ? sql`update tenants set status = 'published', published_snapshot = ${JSON.stringify(
        tenantDraftSnapshot(tenant),
      )}::jsonb, updated_at = now() where id = ${tenant.id} and status <> 'archived'`
    : sql`update tenants set status = 'published', updated_at = now() where id = ${tenant.id} and status <> 'archived'`;
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
  return {
    published: targets.map((p) => `/${p.slug}`),
    blocked,
    warnings,
    url,
  };
}

/** Recibo do comando direto no chat; independe da interpretação do modelo. */
export function publicationMessage(result: PublishResult): string {
  if (result.blocked.length)
    return `Não foi possível publicar por um erro técnico: ${result.blocked.map((item) => `${item.page}: ${item.preflight}`).join(' ')}. O conteúdo publicado foi preservado.`;
  return `Publicado: ${result.url}.${result.warnings?.length ? ' As recomendações continuam disponíveis no painel. A publicação não confirma alegações nem altera as evidências cadastradas.' : ''}`;
}
