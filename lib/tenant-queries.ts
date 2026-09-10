import { db } from '@/lib/db';
import type { BlockInstance, Page, PageType, Seo, Tenant } from '@/lib/types';

type Row = Record<string, unknown>;

/** Converte valor vindo do banco em string sem cair no "[object Object]". */
function str(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  return fallback;
}

function toTenant(row: Row): Tenant {
  return {
    id: str(row.id),
    slug: str(row.slug),
    name: str(row.name),
    status: row.status as Tenant['status'],
    brief: (row.brief ?? {}) as Record<string, unknown>,
    brand: (row.brand ?? {}) as Tenant['brand'],
    dials: (row.dials ?? { variance: 7, motion: 5, density: 4 }) as Tenant['dials'],
    imageGuide: (row.image_guide ?? {}) as Tenant['imageGuide'],
    whatsapp: (row.whatsapp as string) ?? null,
    contactEmail: (row.contact_email as string) ?? null,
    ga4Id: (row.ga4_id as string) ?? null,
    metaPixelId: (row.meta_pixel_id as string) ?? null,
    locale: str(row.locale, 'pt-BR'),
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
    publishedAt: row.published_at ? str(row.published_at) : null,
    navOrder: Number(row.nav_order ?? 0),
  };
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const rows = (await db()`select * from tenants where slug = ${slug} limit 1`) as Row[];
  return rows[0] ? toTenant(rows[0]) : null;
}

export async function listTenants(): Promise<(Tenant & { pageCount: number; leadCount: number })[]> {
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
  }));
}

export async function listPages(tenantId: string): Promise<Page[]> {
  const rows = (await db()`
    select * from pages where tenant_id = ${tenantId} order by nav_order asc, created_at asc
  `) as Row[];
  return rows.map(toPage);
}

export async function getPage(tenantId: string, slug: string): Promise<Page | null> {
  const rows = (await db()`
    select * from pages where tenant_id = ${tenantId} and slug = ${slug} limit 1
  `) as Row[];
  return rows[0] ? toPage(rows[0]) : null;
}

export async function getPageById(id: string): Promise<Page | null> {
  const rows = (await db()`select * from pages where id = ${id} limit 1`) as Row[];
  return rows[0] ? toPage(rows[0]) : null;
}

/** Posts publicados, para a listagem do blog e para o sitemap. */
export async function listPublishedPosts(tenantId: string) {
  const rows = (await db()`
    select slug, title, meta, published_at
    from pages
    where tenant_id = ${tenantId} and type = 'post' and published_blocks is not null
    order by coalesce(meta->>'date', published_at::text) desc
  `) as Row[];
  return rows.map((row) => ({
    slug: str(row.slug),
    title: str(row.title),
    excerpt: (row.meta as { excerpt?: string })?.excerpt,
    date: (row.meta as { date?: string })?.date ?? (row.published_at ? str(row.published_at) : undefined),
  }));
}

export async function listPublishedPages(tenantId: string) {
  const rows = (await db()`
    select slug, type, published_at, published_seo
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
