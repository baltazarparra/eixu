import { isDesignProfile } from '@/lib/design/profile';
import { scenePlan } from '@/lib/images/scene-plan';
import { lintPage } from '@/lib/taste/lint';
import { generatedPhotos, pageImageUrls } from '@/lib/taste/metrics';
import { nextPhase, type Phase } from '@/lib/taste/phases';
import { lintSite, type SiteFinding } from '@/lib/taste/site';
import type { Page, Tenant, TenantImage } from '@/lib/types';

export type PendingImage = {
  id: string;
  seq: number;
  url: string;
  alt: string | null;
  score: number | null;
};

export type GenerationState = {
  next: Phase | 'pronto';
  photos: number;
  targetScenes: number;
  organicPages: number;
  reviewRounds: number;
  blockingErrors: number;
  pendingImages: PendingImage[];
};

/**
 * Progresso da geração pelo estado persistido. O painel decide a próxima etapa
 * por aqui, não pela conversa: recarregar a página não perde o lugar.
 */
export function generationState(
  tenant: Tenant,
  pages: Page[],
  images: TenantImage[],
  siteFindings: SiteFinding[] = lintSite(pages, images, 'publish'),
): GenerationState {
  const design = isDesignProfile(tenant.brand.design)
    ? tenant.brand.design
    : undefined;
  const organic = pages.filter(
    (page) =>
      ['page', 'post'].includes(page.type) &&
      !page.seo.noindex &&
      page.blocks.length > 0,
  );
  const reviewRounds = Number(
    (tenant.brief.generation as { reviewRounds?: number } | undefined)
      ?.reviewRounds ?? 0,
  );
  // A aprovação de imagem é do operador, não do agente: contá-la como erro
  // mantinha a geração presa na fase de revisão, que não tem o que corrigir.
  const blockingErrors = [
    ...siteFindings.filter(
      (finding) =>
        finding.level === 'error' && finding.rule !== 'imagens-aprovacao',
    ),
    ...pages.flatMap((page) =>
      lintPage(page, design).filter((finding) => finding.level === 'error'),
    ),
  ].length;
  const photos = generatedPhotos(images).length;
  const targetScenes = scenePlan(design, Math.max(3, organic.length)).length;
  const used = new Set(pages.flatMap((page) => pageImageUrls(page.blocks)));
  return {
    next: nextPhase({
      hasDesign: Boolean(design),
      generatedPhotos: photos,
      targetScenes,
      organicPages: organic.length,
      blockingErrors,
      reviewRounds,
    }),
    photos,
    targetScenes,
    organicPages: organic.length,
    reviewRounds,
    blockingErrors,
    // Candidatas já usadas no rascunho: é o que o operador precisa aprovar
    // antes de publicar. A crítica da IA não aprova nada.
    pendingImages: images
      .filter((image) => used.has(image.url) && image.status === 'candidata')
      .map((image) => ({
        id: image.id,
        seq: image.seq,
        url: image.url,
        alt: image.alt,
        score: image.score,
      })),
  };
}
