import type { Page, Tenant } from '@/lib/types';

/** Registro histórico da entrega, sem certificar qualidade visual. */
export type GenerationDelivery = {
  completedAt: string;
  /** Preservado nos recibos antigos; não condiciona a conclusão da geração. */
  fingerprint?: string;
};

export function currentDelivery(
  tenant: Tenant,
  pages: Page[],
): GenerationDelivery | null {
  const delivery = (
    tenant.brief.generation as { delivery?: GenerationDelivery } | undefined
  )?.delivery;
  return pages.length > 0 && delivery?.completedAt ? delivery : null;
}
