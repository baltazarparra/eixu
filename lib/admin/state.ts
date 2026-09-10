import { isDesignProfile } from '@/lib/design/profile';
import { generationState } from '@/lib/sites/generation';
import { lintPage } from '@/lib/taste/lint';
import { lintSite } from '@/lib/taste/site';
import type { Page, Tenant, TenantImage } from '@/lib/types';

/** A ordem das chaves JSON não indica uma alteração editorial. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function hasDraftChanges(page: Page): boolean {
  return (
    page.publishedBlocks === null ||
    canonical(page.blocks) !== canonical(page.publishedBlocks) ||
    canonical(page.seo) !== canonical(page.publishedSeo ?? {})
  );
}

/** A renderização inicial e o refresh precisam anunciar o mesmo estado. */
export function workspaceState(
  tenant: Tenant,
  pages: Page[],
  images: TenantImage[],
) {
  const findings = lintSite(pages, images, 'publish');
  const design = isDesignProfile(tenant.brand.design)
    ? tenant.brand.design
    : undefined;
  const pagePaths = new Set(pages.map((page) => `/${page.slug}`));
  const projectFindings = findings.filter(
    (finding) => !pagePaths.has(finding.page),
  );
  return {
    tenant: {
      slug: tenant.slug,
      name: tenant.name,
      hasDesign: Boolean(design),
    },
    generation: generationState(tenant, pages, images, findings),
    errors: projectFindings
      .filter((f) => f.level === 'error')
      .map((f) => f.message),
    warnings: projectFindings
      .filter((f) => f.level === 'warn')
      .map((f) => f.message),
    pages: pages.map((page) => {
      const all = [
        ...lintPage(page, design),
        ...findings.filter((f) => f.page === `/${page.slug}`),
      ];
      return {
        slug: page.slug,
        type: page.type,
        title: page.title,
        blocks: page.blocks.length,
        published: page.publishedBlocks !== null,
        publishedAt: page.publishedAt,
        dirty: hasDraftChanges(page),
        errors: [
          ...new Set(
            all.filter((f) => f.level === 'error').map((f) => f.message),
          ),
        ],
        warnings: [
          ...new Set(
            all.filter((f) => f.level === 'warn').map((f) => f.message),
          ),
        ],
      };
    }),
  };
}

export type SiteState = ReturnType<typeof workspaceState>;
export type PageState = SiteState['pages'][number];
