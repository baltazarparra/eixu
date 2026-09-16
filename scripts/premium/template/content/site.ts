import data from './site.json';
import type { Page, Tenant } from '@/lib/types';

export const tenant = {
  ...data.tenant,
  brief: {},
  imageGuide: {},
  publishedSnapshot: data.tenant.publishedSnapshot,
} as unknown as Tenant;

export const pages = data.pages.map((page) => ({
  ...page,
  tenantId: tenant.id,
  publishedBlocks: page.blocks,
  publishedSeo: page.seo,
  publishedTitle: page.title,
  publishedType: page.type,
  publishedMeta: page.meta,
  publishedNavOrder: page.navOrder,
  publishedAt: page.publishedAt,
})) as unknown as Page[];

export const posts = pages
  .filter((page) => page.type === 'post')
  .map((post) => ({
    slug: post.slug,
    title: post.title,
    excerpt: post.meta.excerpt,
    date: post.meta.date,
  }));
