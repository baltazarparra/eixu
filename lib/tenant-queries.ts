import { db } from '@/lib/db';
import { contactsOf } from '@/lib/tenant-contacts';
import { intakeSocialUrl } from '@/lib/tenant-intake';
import type { BlockInstance, Page, PageType, Seo, Tenant } from '@/lib/types';

type Row = Record<string, unknown>;

/** Converte valor vindo do banco em string sem cair no "[object Object]". */
function str(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (value instanceof Date) return value.toISOString();
  return fallback;
}

function toTenant(row: Row): Tenant {
  const brief = (row.brief ?? {}) as Record<string, unknown>;
  return {
    id: str(row.id),
    slug: str(row.slug),
    name: str(row.name),
    status: row.status as Tenant['status'],
    brief,
    brand: (row.brand ?? {}) as Tenant['brand'],
    dials: (row.dials ?? {
      variance: 7,
      motion: 5,
      density: 4,
    }) as Tenant['dials'],
    imageGuide: (row.image_guide ?? {}) as Tenant['imageGuide'],
    // O primeiro salvamento de Dados também precisa conservar o perfil que
    // os clientes antigos guardavam apenas no briefing.
    contacts: contactsOf(
      row.contacts,
      (row.whatsapp as string) ?? null,
      intakeSocialUrl(brief.intake),
    ),
    whatsapp: (row.whatsapp as string) ?? null,
    contactEmail: (row.contact_email as string) ?? null,
    ga4Id: (row.ga4_id as string) ?? null,
    metaPixelId: (row.meta_pixel_id as string) ?? null,
    locale: str(row.locale, 'pt-BR'),
    publishedSnapshot:
      (row.published_snapshot as Tenant['publishedSnapshot']) ?? null,
  };
}

function toPage(row: Row): Page {
  return {
    id: str(row.id),
    tenantId: str(row.tenant_id),
    slug: str(row.slug),
    type: row.type as PageType,
    title: str(row.title),
    seo: (row.seo ?? {}) as Seo,
    meta: (row.meta ?? {}) as Page['meta'],
    blocks: (row.blocks ?? []) as BlockInstance[],
    publishedBlocks: (row.published_blocks ?? null) as BlockInstance[] | null,
    publishedSeo: (row.published_seo ?? null) as Seo | null,
    publishedTitle: row.published_title ? str(row.published_title) : null,
    publishedType: (row.published_type as PageType | null) ?? null,
    publishedMeta: (row.published_meta ?? null) as Page['meta'] | null,
    publishedNavOrder:
      row.published_nav_order === null || row.published_nav_order === undefined
        ? null
        : Number(row.published_nav_order),
    publishedAt: row.published_at ? str(row.published_at) : null,
    navOrder: Number(row.nav_order ?? 0),
  };
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const rows =
    (await db()`select * from tenants where slug = ${slug} limit 1`) as Row[];
  return rows[0] ? toTenant(rows[0]) : null;
}

export async function listTenants(): Promise<
  (Tenant & { pageCount: number; leadCount: number; updatedAt: string })[]
> {
  const rows = (await db()`
    select t.*,
      (select count(*) from pages p where p.tenant_id = t.id) as page_count,
      (select count(*) from leads l where l.tenant_id = t.id) as lead_count
    from tenants t
    order by t.created_at desc
  `) as Row[];
  return rows.map((row) => ({
    ...toTenant(row),
    pageCount: Number(row.page_count ?? 0),
    leadCount: Number(row.lead_count ?? 0),
    updatedAt: str(row.updated_at),
  }));
}

/** Contagens do que a exclusão leva junto, para o diálogo de confirmação. */
export async function countTenantData(
  tenantId: string,
): Promise<{ pages: number; leads: number; images: number }> {
  const rows = (await db()`
    select
      (select count(*) from pages where tenant_id = ${tenantId}) as pages,
      (select count(*) from leads where tenant_id = ${tenantId}) as leads,
      (select count(*) from images where tenant_id = ${tenantId}) as images
  `) as Row[];
  return {
    pages: Number(rows[0]?.pages ?? 0),
    leads: Number(rows[0]?.leads ?? 0),
    images: Number(rows[0]?.images ?? 0),
  };
}

/** Define o logo do site. Nav e rodapé passam a usar a imagem. */
export async function setBrandLogo(
  tenantId: string,
  url: string | null,
): Promise<Record<string, unknown>> {
  const rows = (await db()`
    update tenants set
      brand = case when ${url}::text is null then brand - 'logoUrl'
                   else brand || jsonb_build_object('logoUrl', ${url}::text) end,
      updated_at = now()
    where id = ${tenantId}
    returning brand
  `) as Row[];
  return (rows[0]?.brand ?? {}) as Record<string, unknown>;
}

export async function listPages(tenantId: string): Promise<Page[]> {
  const rows = (await db()`
    select * from pages where tenant_id = ${tenantId} order by nav_order asc, created_at asc
  `) as Row[];
  return rows.map(toPage);
}

export async function getPage(
  tenantId: string,
  slug: string,
): Promise<Page | null> {
  const rows = (await db()`
    select * from pages where tenant_id = ${tenantId} and slug = ${slug} limit 1
  `) as Row[];
  return rows[0] ? toPage(rows[0]) : null;
}

export async function getPageById(id: string): Promise<Page | null> {
  const rows =
    (await db()`select * from pages where id = ${id} limit 1`) as Row[];
  return rows[0] ? toPage(rows[0]) : null;
}

/** Posts publicados, para a listagem do blog e para o sitemap. */
export async function listPublishedPosts(tenantId: string) {
  const rows = (await db()`
    select slug,
           coalesce(published_title, title) as title,
           coalesce(published_meta, meta) as meta,
           published_at
    from pages
    where tenant_id = ${tenantId}
      and coalesce(published_type, type) = 'post'
      and published_blocks is not null
    order by coalesce(coalesce(published_meta, meta)->>'date', published_at::text) desc
  `) as Row[];
  return rows.map((row) => ({
    slug: str(row.slug),
    title: str(row.title),
    excerpt: (row.meta as { excerpt?: string })?.excerpt,
    date:
      (row.meta as { date?: string })?.date ??
      (row.published_at ? str(row.published_at) : undefined),
  }));
}

export async function listPublishedPages(tenantId: string) {
  const rows = (await db()`
    select slug, coalesce(published_type, type) as type, published_at, published_seo
    from pages
    where tenant_id = ${tenantId} and published_blocks is not null
  `) as Row[];
  return rows
    .map((row) => ({
      slug: str(row.slug),
      type: row.type as PageType,
      publishedAt: row.published_at ? str(row.published_at) : null,
      seo: (row.published_seo ?? {}) as Seo,
    }))
    .filter((page) => page.type !== 'thank_you' && !page.seo.noindex);
}
