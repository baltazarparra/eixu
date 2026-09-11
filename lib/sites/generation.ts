import { isDesignProfile } from '@/lib/design/profile';
import {
  scenePlan,
  sceneCoverage,
  type PlannedScene,
} from '@/lib/images/scene-plan';
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
  return scenePlan(design, 3);
}

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
  const blockingErrors = [
    ...siteFindings.filter((finding) => finding.level === 'error'),
    ...pages.flatMap((page) =>
      lintPage(page, design).filter((finding) => finding.level === 'error'),
    ),
  ].length;

  const available = generatedPhotos(images);
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
    }),
    photos: available.length,
    coveredScenes: covered.length,
    targetScenes: plan.length,
    nextScene: missing[0] ?? null,
    organicPages: organic.length,
    reviewRounds,
    blockingErrors,
  };
}
