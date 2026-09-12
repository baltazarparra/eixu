import { reviewFingerprint } from '@/lib/review/state';
import type { Page, Tenant, TenantImage } from '@/lib/types';

/** Entrega do rascunho, independente do certificado de revisão visual. */
export type GenerationDelivery = {
  fingerprint: string;
  completedAt: string;
};

export function currentDelivery(
  tenant: Tenant,
  pages: Page[],
  images: TenantImage[],
): GenerationDelivery | null {
  const delivery = (
    tenant.brief.generation as { delivery?: GenerationDelivery } | undefined
  )?.delivery;
  return delivery?.completedAt &&
    delivery.fingerprint === reviewFingerprint(tenant, pages, images)
    ? delivery
    : null;
}
