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

/** Marca, contato, conteúdo e acervo podem mudar fora do chat. */
export function reviewFingerprint(
  tenant: Tenant,
  pages: Page[],
  images: TenantImage[],
) {
  const { generation: _generation, ...brief } = tenant.brief;
  return createHash('sha256')
    .update(
      canonical({
        harness: HARNESS_VERSION,
        deployment: process.env.VERCEL_GIT_COMMIT_SHA ?? HARNESS_VERSION,
        name: tenant.name,
        brand: tenant.brand,
        dials: tenant.dials,
        contacts: tenant.contacts,
        whatsapp: tenant.whatsapp,
        contactEmail: tenant.contactEmail,
        brief,
        imageGuide: tenant.imageGuide,
        pages: [...pages]
          .sort((a, b) => a.slug.localeCompare(b.slug))
          .map(({ slug, type, title, blocks, seo, meta }) => ({
            slug,
            type,
            title,
            blocks,
            seo,
            meta,
          })),
        images: [...images]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map(({ id, url, status, alt }) => ({ id, url, status, alt })),
      }),
    )
    .digest('hex');
}

export type ReviewReceipt = {
  fingerprint: string;
  complete: boolean;
  errors: number;
  visual: 'complete' | 'unavailable' | 'disabled';
  reviewedAt: string;
  findings?: {
    pagina: string;
    nivel: string;
    regra: string;
    bloco?: string;
    correcao: string;
  }[];
};

export function currentReview(
  tenant: Tenant,
  pages: Page[],
  images: TenantImage[],
): ReviewReceipt | null {
  const generation = tenant.brief.generation as
    | { review?: ReviewReceipt }
    | undefined;
  const receipt = generation?.review;
  return receipt &&
    receipt.fingerprint === reviewFingerprint(tenant, pages, images)
    ? receipt
    : null;
}

/** Produção e desenvolvimento revisam pixels; 0 é uma opção explícita de diagnóstico. */
export function captureEnabled(): boolean {
  return process.env.EIXU_REVIEW_CAPTURE !== '0';
}
