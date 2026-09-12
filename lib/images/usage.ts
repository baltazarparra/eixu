import type { Page, Tenant, TenantImage } from '@/lib/types';

export type ImageUsage = {
  scope: 'draft' | 'published';
  page: string | null;
  block: string | null;
  kind: 'page' | 'logo';
};

function containsUrl(value: unknown, url: string): boolean {
  if (typeof value === 'string') return value === url;
  if (Array.isArray(value)) return value.some((item) => containsUrl(item, url));
  if (value && typeof value === 'object')
    return Object.values(value).some((item) => containsUrl(item, url));
  return false;
}

/**
 * Localiza referências exatas no rascunho e no snapshot publicado. O resultado
 * fica separado porque uma imagem pode ter saído do editor e continuar no ar.
 */
export function imageUsage(
  tenant: Tenant,
  pages: Page[],
  images: TenantImage[],
): Record<string, ImageUsage[]> {
  return Object.fromEntries(
    images.map((image) => {
      const usage: ImageUsage[] = [];
      // A versão para fundo escuro é uso de logo tanto quanto a principal.
      const draft = tenant.brand;
      const published = tenant.publishedSnapshot?.brand;
      if (draft.logoUrl === image.url || draft.logoDarkUrl === image.url)
        usage.push({ scope: 'draft', page: null, block: null, kind: 'logo' });
      if (
        published &&
        (published.logoUrl === image.url ||
          published.logoDarkUrl === image.url)
      )
        usage.push({
          scope: 'published',
          page: null,
          block: null,
          kind: 'logo',
        });
      for (const page of pages) {
        for (const block of page.blocks)
          if (containsUrl(block.props, image.url))
            usage.push({
              scope: 'draft',
              page: `/${page.slug}`,
              block: block.id,
              kind: 'page',
            });
        for (const block of page.publishedBlocks ?? [])
          if (containsUrl(block.props, image.url))
            usage.push({
              scope: 'published',
              page: `/${page.slug}`,
              block: block.id,
              kind: 'page',
            });
      }
      return [image.id, usage];
    }),
  );
}
