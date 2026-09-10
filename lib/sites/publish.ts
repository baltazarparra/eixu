import { db } from '@/lib/db';
import { isDesignProfile } from '@/lib/design/profile';
import { hasDuplicateComposition } from '@/lib/design/uniqueness';
import { listImages } from '@/lib/images/queries';
import { formatFindings, lintPage } from '@/lib/taste/lint';
import { lintSite, publicationState } from '@/lib/taste/site';
import { listPages } from '@/lib/tenant-queries';
import type { Tenant } from '@/lib/types';

/** API e agente publicam pelo mesmo gate e pela mesma transação. */
export async function publishSite(tenant: Tenant, slug?: string) {
  const [pages, images] = await Promise.all([
    listPages(tenant.id),
    listImages(tenant.id),
  ]);
  const clean = slug?.replace(/^\/+|\/+$/g, '');
  const targets =
    clean === undefined ? pages : pages.filter((p) => p.slug === clean);
  const blocked: { page: string; preflight: string }[] = [];
  if (!targets.length)
    blocked.push({
      page: clean ?? '/',
      preflight: 'Nenhuma página encontrada para publicar.',
    });
  const ids = new Set(targets.map((p) => p.id));
  // Uma publicação pontual não pode contar rascunhos ainda fora do ar.
  const live = publicationState(pages, ids);
  for (const page of targets) {
    const errors = lintPage(page, tenant.brand.design).filter(
      (f) => f.level === 'error',
    );
    if (errors.length)
      blocked.push({
        page: `/${page.slug}`,
        preflight: formatFindings(errors),
      });
  }
  for (const finding of lintSite(live, images, 'publish'))
    blocked.push({ page: finding.page, preflight: formatFindings([finding]) });
  const home = live.find((p) => p.slug === '');
  if (
    home &&
    isDesignProfile(tenant.brand.design) &&
    (await hasDuplicateComposition(tenant.id, home.blocks))
  )
    blocked.push({
      page: '/',
      preflight:
        'ERRO [composicao-duplicada] A home repete a silhueta estrutural de outro cliente.',
    });
  const url = `https://${tenant.slug}.eixu.com.br`;
  if (blocked.length) return { published: [] as string[], blocked, url };
  const sql = db();
  // Publica exatamente os valores validados, mesmo se um rascunho mudar durante a consulta.
  await sql.transaction([
    ...targets.map(
      (page) =>
        sql`update pages set published_blocks = ${JSON.stringify(page.blocks)}::jsonb, published_seo = ${JSON.stringify(page.seo)}::jsonb, published_at = now(), updated_at = now() where id = ${page.id} and tenant_id = ${tenant.id}`,
    ),
    sql`update tenants set status = 'published' where id = ${tenant.id}`,
  ]);
  return { published: targets.map((p) => `/${p.slug}`), blocked, url };
}
