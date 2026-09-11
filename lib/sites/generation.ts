import { isDesignProfile } from '@/lib/design/profile';
import {
  scenePlan,
  sceneCoverage,
  takeScene,
  type PlannedScene,
} from '@/lib/images/scene-plan';
import { lintPage } from '@/lib/taste/lint';
import { generatedPhotos, pageImageUrls } from '@/lib/taste/metrics';
import { nextPhase, type Phase } from '@/lib/taste/phases';
import { lintSite, type SiteFinding } from '@/lib/taste/site';
import type { ImageKind, Page, Tenant, TenantImage } from '@/lib/types';

export type PendingImage = {
  id: string;
  seq: number;
  kind: ImageKind;
  url: string;
  alt: string | null;
  score: number | null;
  ratio: string;
  targetBlock: string | null;
  requestText: string;
  /** Papel do plano que esta cena preencheria, quando houver vaga. */
  role: string | null;
  variant: string | null;
  problemas: string[];
  pontosFortes: string[];
  /** Mensagem do crítico quando ele próprio falhou. */
  critiqueError: string | null;
  usedInDraft: boolean;
};

export type GenerationState = {
  next: Phase | 'pronto';
  /** Fotos geradas e aprovadas na biblioteca. */
  photos: number;
  /** Vagas do plano já preenchidas por foto aprovada. */
  coveredScenes: number;
  targetScenes: number;
  nextScene: PlannedScene | null;
  organicPages: number;
  reviewRounds: number;
  blockingErrors: number;
  pendingImages: PendingImage[];
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

  // Só foto aprovada preenche vaga do plano: a candidata ainda depende da
  // decisão do operador e não pode entrar no rascunho.
  const approved = generatedPhotos(images).filter(
    (image) => image.status === 'aprovada',
  );
  const plan = plannedScenes(tenant);
  const { covered, missing } = sceneCoverage(plan, approved);
  const remaining = [...missing];

  const used = new Set(pages.flatMap((page) => pageImageUrls(page.blocks)));
  const pendingImages = images
    .filter((image) => image.status === 'candidata')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.seq - b.seq)
    .map((image) => {
      const scene = image.kind === 'foto' ? takeScene(remaining, image) : null;
      return {
        id: image.id,
        seq: image.seq,
        kind: image.kind,
        url: image.url,
        alt: image.alt,
        score: image.score,
        ratio: image.ratio,
        targetBlock: image.targetBlock,
        requestText: image.requestText,
        role: scene?.role ?? null,
        variant:
          typeof image.critique.variante === 'string'
            ? image.critique.variante
            : null,
        problemas: image.critique.problemas ?? [],
        pontosFortes: image.critique.pontos_fortes ?? [],
        critiqueError: image.critique.erro ?? null,
        usedInDraft: used.has(image.url),
      };
    });

  return {
    next: nextPhase({
      hasDesign: Boolean(design),
      coveredScenes: covered.length,
      targetScenes: plan.length,
      organicPages: organic.length,
      blockingErrors,
      reviewRounds,
    }),
    photos: approved.length,
    coveredScenes: covered.length,
    targetScenes: plan.length,
    nextScene: missing[0] ?? null,
    organicPages: organic.length,
    reviewRounds,
    blockingErrors,
    pendingImages,
  };
}
