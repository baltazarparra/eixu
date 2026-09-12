import { createHash } from 'node:crypto';
import { HARNESS_VERSION } from '@/lib/ai/models';
import type { Page, Tenant, TenantImage } from '@/lib/types';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

function hash(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

const deploymentVersion = () =>
  process.env.VERCEL_GIT_COMMIT_SHA ?? HARNESS_VERSION;

/** Strings que podem apontar para uma imagem usada pelo rascunho. */
function collectStrings(value: unknown, output: Set<string>): void {
  if (typeof value === 'string') {
    output.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, output);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectStrings(item, output);
  }
}

/**
 * Só uma imagem efetivamente referenciada pode invalidar a evidência visual.
 * O acervo é append-only na operação normal; incluir as 200 fotos fazia uma
 * geração sem uso recapturar todas as páginas.
 */
function imageDependencies(tenant: Tenant, page: Page, images: TenantImage[]) {
  const references = new Set<string>();
  collectStrings(page.blocks, references);
  if (tenant.brand.logoUrl) references.add(tenant.brand.logoUrl);
  return images
    .filter((image) => references.has(image.url))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(({ id, url, status, alt }) => ({ id, url, status, alt }));
}

/** Dependências globais que alteram a renderização ou o julgamento factual. */
function reviewContext(tenant: Tenant) {
  const { generation: _generation, ...brief } = tenant.brief;
  return {
    harness: HARNESS_VERSION,
    deployment: deploymentVersion(),
    name: tenant.name,
    brand: tenant.brand,
    dials: tenant.dials,
    contacts: tenant.contacts,
    whatsapp: tenant.whatsapp,
    contactEmail: tenant.contactEmail,
    brief,
    imageGuide: tenant.imageGuide,
  };
}

/** Assinatura independente de uma página, usada pela revisão incremental. */
export function pageReviewFingerprint(
  tenant: Tenant,
  page: Page,
  images: TenantImage[],
): string {
  return hash({
    context: reviewContext(tenant),
    page: {
      slug: page.slug,
      type: page.type,
      title: page.title,
      blocks: page.blocks,
      seo: page.seo,
      meta: page.meta,
    },
    images: imageDependencies(tenant, page, images),
  });
}

/** Assinatura do certificado completo, composta pelos recibos por página. */
export function reviewFingerprint(
  tenant: Tenant,
  pages: Page[],
  images: TenantImage[],
): string {
  return hash(
    [...pages]
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map((page) => ({
        page: `/${page.slug}`,
        fingerprint: pageReviewFingerprint(tenant, page, images),
      })),
  );
}

/**
 * O iframe precisa atualizar apenas quando o HTML/CSS produzido muda. Briefing,
 * rodada de revisão e imagens fora das páginas não mudam os pixels.
 */
export function previewFingerprint(tenant: Tenant, pages: Page[]): string {
  return hash({
    deployment: deploymentVersion(),
    tenant: {
      name: tenant.name,
      brand: tenant.brand,
      dials: tenant.dials,
      contacts: tenant.contacts,
      whatsapp: tenant.whatsapp,
      contactEmail: tenant.contactEmail,
    },
    pages: [...pages]
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map(({ slug, type, title, blocks, meta }) => ({
        slug,
        type,
        title,
        blocks,
        meta,
      })),
  });
}

export type ReviewFindingReceipt = {
  id?: string;
  pagina: string;
  nivel: string;
  regra: string;
  bloco?: string;
  evidencia?: string;
  correcao: string;
  viewport?: 'desktop' | 'mobile';
  status?: 'open' | 'resolved';
};

export type PageReviewReceipt = {
  fingerprint: string;
  visual: 'complete' | 'unavailable' | 'disabled';
  viewports: { desktop: boolean; mobile: boolean };
  errors: number;
  reviewedAt: string;
  findings: ReviewFindingReceipt[];
};

export type ReviewReceipt = {
  /** Ausente nos recibos legados, que continuam válidos pelo fingerprint. */
  version?: 2;
  fingerprint: string;
  complete: boolean;
  errors: number;
  visual: 'complete' | 'unavailable' | 'disabled';
  reviewedAt: string;
  findings?: ReviewFindingReceipt[];
  pages?: Record<string, PageReviewReceipt>;
  timings?: {
    preflightMs: number;
    captureMs: number;
    criticMs: number;
  };
};

export function savedReview(tenant: Tenant): ReviewReceipt | null {
  const generation = tenant.brief.generation as
    | { review?: ReviewReceipt }
    | undefined;
  return generation?.review ?? null;
}

/** Páginas que ainda não têm pixels completos para a versão atual. */
export function pendingReviewPages(
  tenant: Tenant,
  pages: Page[],
  images: TenantImage[],
  receipt: ReviewReceipt | null = savedReview(tenant),
): Page[] {
  if (receipt?.version !== 2 || !receipt.pages) return pages;
  return pages.filter((page) => {
    const saved = receipt.pages?.[`/${page.slug}`];
    return (
      !saved ||
      saved.fingerprint !== pageReviewFingerprint(tenant, page, images) ||
      saved.visual !== 'complete' ||
      !saved.viewports.desktop ||
      !saved.viewports.mobile
    );
  });
}

export function currentReview(
  tenant: Tenant,
  pages: Page[],
  images: TenantImage[],
): ReviewReceipt | null {
  const receipt = savedReview(tenant);
  if (
    !receipt ||
    receipt.fingerprint !== reviewFingerprint(tenant, pages, images)
  )
    return null;
  if (receipt.version !== 2) return receipt;
  return pendingReviewPages(tenant, pages, images, receipt).length === 0
    ? receipt
    : null;
}

/** Produção e desenvolvimento revisam pixels; 0 é uma opção explícita de diagnóstico. */
export function captureEnabled(): boolean {
  return process.env.EIXU_REVIEW_CAPTURE !== '0';
}
