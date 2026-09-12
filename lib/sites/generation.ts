import { isDesignProfile } from '@/lib/design/profile';
import { currentReview } from '@/lib/review/state';
import { currentDelivery } from '@/lib/generation/delivery';
import {
  plannedSceneInputSchema,
  scenePlan,
  sceneCoverage,
  sceneRequestsMatchPlan,
  type PlannedScene,
} from '@/lib/images/scene-plan';
import { vibeOf } from '@/lib/design/vibes';
import { lintPage } from '@/lib/taste/lint';
import { generatedPhotos } from '@/lib/taste/metrics';
import { nextPhase, type Phase } from '@/lib/taste/phases';
import { lintSite, type SiteFinding } from '@/lib/taste/site';
import type { Page, Tenant, TenantImage } from '@/lib/types';

export type GenerationState = {
  next: Phase | 'pronto';
  /** Fotos geradas disponíveis na biblioteca. */
  photos: number;
  /** Vagas do plano já preenchidas por foto disponível. */
  coveredScenes: number;
  targetScenes: number;
  nextScene: PlannedScene | null;
  organicPages: number;
  reviewRounds: number;
  reviewComplete: boolean;
  blockingErrors: number;
};

/**
 * Plano de cenas do cliente, sempre medido em três páginas orgânicas. Deixar o
 * plano crescer com as páginas gravadas devolveria a geração para a etapa de
 * cenas logo depois da composição; página extra recebe foto pelo chat livre.
 */
export function plannedScenes(tenant: Tenant): PlannedScene[] {
  const design = isDesignProfile(tenant.brand.design)
    ? tenant.brand.design
    : undefined;
  const structural = scenePlan(design, 3, vibeOf(tenant.brand));
  const parsed = plannedSceneInputSchema
    .array()
    .safeParse(tenant.brief.imageScenes);
  if (!parsed.success || !sceneRequestsMatchPlan(structural, parsed.data))
    return structural;
  const remaining = [...structural];
  return parsed.data.map((request) => {
    const index = remaining.findIndex(
      (scene) =>
        scene.role === request.role &&
        scene.targetBlock === request.targetBlock,
    );
    const [slot] = remaining.splice(index, 1);
    return {
      ...slot,
      request: request.request,
      page: request.page,
      hint: request.page ? `${slot.hint} Página ${request.page}.` : slot.hint,
    };
  });
}

/**
 * Progresso da geração pelo estado persistido. O painel decide a próxima etapa
 * por aqui, não pela conversa: recarregar a página não perde o lugar.
 */
export function generationState(
  tenant: Tenant,
  pages: Page[],
  images: TenantImage[],
  siteFindings: SiteFinding[] = lintSite(
    pages,
    images,
    'publish',
    tenant.brand,
  ),
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
  const blockingErrors = [
    ...siteFindings.filter((finding) => finding.level === 'error'),
    ...pages.flatMap((page) =>
      lintPage(page, design).filter((finding) => finding.level === 'error'),
    ),
  ].length;

  const available = generatedPhotos(images);
  const review = currentReview(tenant, pages, images);
  const plan = plannedScenes(tenant);
  const { covered, missing } = sceneCoverage(plan, available);

  return {
    next: nextPhase({
      hasDesign: Boolean(design),
      coveredScenes: covered.length,
      targetScenes: plan.length,
      organicPages: organic.length,
      blockingErrors,
      reviewRounds,
      delivered: Boolean(currentDelivery(tenant, pages)),
      reviewComplete:
        review?.complete === true &&
        review.visual === 'complete' &&
        review.errors === 0,
    }),
    photos: available.length,
    coveredScenes: covered.length,
    targetScenes: plan.length,
    nextScene: missing[0] ?? null,
    organicPages: organic.length,
    reviewRounds,
    reviewComplete:
      review?.complete === true &&
      review.visual === 'complete' &&
      review.errors === 0,
    blockingErrors,
  };
}
