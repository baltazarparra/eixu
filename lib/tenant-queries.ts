import { db } from '@/lib/db';
import { contactsOf } from '@/lib/tenant-contacts';
import { intakeSocialUrl } from '@/lib/tenant-intake';
import type { Brand, Tenant } from '@/lib/types';

type Row = Record<string, unknown>;

function text(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (value instanceof Date) return value.toISOString();
  return fallback;
}

export function tenantFromRow(row: Row): Tenant {
  const brief = (row.brief ?? {}) as Record<string, unknown>;
  return {
    id: text(row.id),
    slug: text(row.slug),
    name: text(row.name),
    status: row.status as Tenant['status'],
    brief,
    brand: (row.brand ?? {}) as Brand,
    contacts: contactsOf(
      row.contacts,
      (row.whatsapp as string) ?? null,
      intakeSocialUrl(brief.intake),
    ),
    whatsapp: (row.whatsapp as string) ?? null,
    contactEmail: (row.contact_email as string) ?? null,
    ga4Id: (row.ga4_id as string) ?? null,
    metaPixelId: (row.meta_pixel_id as string) ?? null,
    locale: text(row.locale, 'pt-BR'),
  };
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const rows =
    (await db()`select * from tenants where slug = ${slug} limit 1`) as Row[];
  return rows[0] ? tenantFromRow(rows[0]) : null;
}

export async function listTenants(): Promise<
  (Tenant & { folderId: string | null; updatedAt: string })[]
> {
  const rows = (await db()`
    select * from tenants order by created_at desc
  `) as Row[];
  return rows.map((row) => ({
    ...tenantFromRow(row),
    folderId: row.folder_id ? text(row.folder_id) : null,
    updatedAt: text(row.updated_at),
  }));
}

export type SiteFolderSummary = {
  id: string;
  name: string;
  siteCount: number;
};

export async function listSiteFolders(): Promise<SiteFolderSummary[]> {
  const rows = (await db()`
    select folder.id, folder.name, count(tenant.id)::int as site_count
    from site_folders folder
    left join tenants tenant on tenant.folder_id = folder.id
    group by folder.id, folder.name
    order by lower(folder.name), folder.created_at
  `) as Row[];
  return rows.map((row) => ({
    id: text(row.id),
    name: text(row.name),
    siteCount: Number(row.site_count ?? 0),
  }));
}

export async function siteFolderExists(id: string): Promise<boolean> {
  const rows = (await db()`
    select exists(select 1 from site_folders where id = ${id}) as exists
  `) as { exists: boolean }[];
  return rows[0]?.exists === true;
}

/** Contagens apresentadas antes de excluir um cliente. */
export async function countTenantData(
  tenantId: string,
): Promise<{ pages: number; leads: number; images: number }> {
  const rows = (await db()`
    select
      coalesce((
        select jsonb_array_length(revision.contract->'pages')
        from studio_projects project
        join studio_content_revisions revision
          on revision.id = project.active_content_revision_id
        where project.tenant_id = ${tenantId}
        limit 1
      ), 0) as pages,
      (select count(*) from leads where tenant_id = ${tenantId}) as leads,
      (select count(*) from images where tenant_id = ${tenantId}) as images
  `) as Row[];
  return {
    pages: Number(rows[0]?.pages ?? 0),
    leads: Number(rows[0]?.leads ?? 0),
    images: Number(rows[0]?.images ?? 0),
  };
}

export async function setBrandLogo(
  tenantId: string,
  url: string | null,
): Promise<Brand> {
  const rows = (await db()`
    update tenants
    set brand = case
      when ${url}::text is null then brand - 'logoUrl'
      else brand || jsonb_build_object('logoUrl', ${url}::text)
    end,
    updated_at = now()
    where id = ${tenantId}
    returning brand
  `) as Row[];
  return (rows[0]?.brand ?? {}) as Brand;
}
