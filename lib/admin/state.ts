import { isDesignProfile } from '@/lib/design/profile';
import { generationState } from '@/lib/sites/generation';
import {
  currentReview,
  previewFingerprint,
  savedReview,
} from '@/lib/review/state';
import { lintPage } from '@/lib/taste/lint';
import { lintSite } from '@/lib/taste/site';
import { tenantDraftSnapshot } from '@/lib/sites/snapshot';
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
    canonical(page.seo) !== canonical(page.publishedSeo ?? {}) ||
    (page.publishedTitle !== null &&
      page.publishedTitle !== undefined &&
      page.title !== page.publishedTitle) ||
    (page.publishedType !== null &&
      page.publishedType !== undefined &&
      page.type !== page.publishedType) ||
    (page.publishedMeta !== null &&
      page.publishedMeta !== undefined &&
      canonical(page.meta) !== canonical(page.publishedMeta)) ||
    (page.publishedNavOrder !== null &&
      page.publishedNavOrder !== undefined &&
      page.navOrder !== page.publishedNavOrder)
  );
}

export function hasTenantDraftChanges(tenant: Tenant): boolean {
  return Boolean(
    tenant.publishedSnapshot &&
    canonical(tenantDraftSnapshot(tenant)) !==
      canonical(tenant.publishedSnapshot),
  );
}

/** A renderização inicial e o refresh precisam anunciar o mesmo estado. */
export function workspaceState(
  tenant: Tenant,
  pages: Page[],
  images: TenantImage[],
) {
  const findings = lintSite(pages, images, 'publish', tenant.brand);
  const design = isDesignProfile(tenant.brand.design)
    ? tenant.brand.design
    : undefined;
  const saved = savedReview(tenant);
  const review = currentReview(tenant, pages, images);
  const pagePaths = new Set(pages.map((page) => `/${page.slug}`));
  const projectFindings = findings.filter(
    (finding) => !pagePaths.has(finding.page),
  );
  return {
    previewRevision: previewFingerprint(tenant, pages),
    tenant: {
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status,
      hasDesign: Boolean(design),
      dirty: hasTenantDraftChanges(tenant),
    },
    generation: generationState(tenant, pages, images, findings),
    review: {
      current: Boolean(review),
      complete:
        review?.complete === true &&
        review.visual === 'complete' &&
        review.errors === 0,
      visual: review?.visual ?? saved?.visual ?? null,
      reviewedAt: review?.reviewedAt ?? saved?.reviewedAt ?? null,
      errors: review?.errors ?? 0,
      findings: (review?.findings ?? []).map((finding) => ({
        id: finding.id ?? `${finding.pagina}-${finding.regra}`,
        page: finding.pagina,
        level: finding.nivel,
        rule: finding.regra,
        block: finding.bloco ?? null,
        evidence: finding.evidencia ?? null,
        correction: finding.correcao,
        viewport: finding.viewport ?? null,
        status: finding.status ?? 'open',
      })),
      pages: Object.entries(review?.pages ?? {}).map(([page, receipt]) => ({
        page,
        visual: receipt.visual,
        desktop: receipt.viewports.desktop,
        mobile: receipt.viewports.mobile,
        errors: receipt.errors,
      })),
    },
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
