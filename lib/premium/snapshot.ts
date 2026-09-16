import { createHash } from 'node:crypto';
import { publicPage, publicTenant } from '@/lib/sites/snapshot';
import type { Page, Tenant } from '@/lib/types';
import type { PremiumSourceSnapshot } from '@/lib/premium/types';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

function publicUrls(value: unknown, found: Set<string>): void {
  if (typeof value === 'string') {
    if (/^https:\/\//i.test(value)) found.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) publicUrls(item, found);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const item of Object.values(value)) publicUrls(item, found);
}

export function premiumSourceSnapshot(
  tenant: Tenant,
  pages: Page[],
): PremiumSourceSnapshot {
  if (!tenant.publishedSnapshot)
    throw new Error('O site publicado ainda não possui snapshot global.');
  const renderedTenant = publicTenant(tenant);
  const published = pages
    .filter((page) => page.publishedBlocks !== null)
    .map((page) => {
      const rendered = publicPage(page);
      return {
        id: page.id,
        slug: page.slug,
        type: rendered.type,
        title: rendered.title,
        seo: page.publishedSeo ?? {},
        meta: rendered.meta,
        blocks: page.publishedBlocks ?? [],
        navOrder: rendered.navOrder,
        publishedAt: page.publishedAt,
      };
    })
    .sort((left, right) =>
      left.navOrder === right.navOrder
        ? left.slug.localeCompare(right.slug)
        : left.navOrder - right.navOrder,
    );
  if (!published.length)
    throw new Error('O site não possui páginas publicadas para converter.');

  const snapshot: PremiumSourceSnapshot = {
    version: 1,
    tenant: {
      id: renderedTenant.id,
      slug: renderedTenant.slug,
      name: renderedTenant.name,
      status: renderedTenant.status,
      maintenanceMode: 'premium',
      publicRuntime: 'premium',
      brand: renderedTenant.brand,
      dials: renderedTenant.dials,
      contacts: renderedTenant.contacts,
      whatsapp: renderedTenant.whatsapp,
      contactEmail: renderedTenant.contactEmail,
      ga4Id: renderedTenant.ga4Id,
      metaPixelId: renderedTenant.metaPixelId,
      locale: renderedTenant.locale,
      publishedSnapshot: tenant.publishedSnapshot,
    },
    pages: published,
    assets: [],
  };
  const assets = new Set<string>();
  publicUrls(snapshot.tenant.brand, assets);
  publicUrls(snapshot.pages, assets);
  snapshot.assets = [...assets].sort();
  return snapshot;
}

export function premiumSourceHash(snapshot: PremiumSourceSnapshot): string {
  // O banco recebe JSONB. Normalize antes do hash para que propriedades
  // `undefined`, descartadas por JSON.stringify, nao mudem o recibo no worker.
  const json = JSON.parse(JSON.stringify(snapshot)) as PremiumSourceSnapshot;
  return createHash('sha256').update(canonical(json)).digest('hex');
}
